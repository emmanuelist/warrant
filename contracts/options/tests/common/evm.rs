//! A wallet from another chain, acting through intents it signs and another account relays
//! (D-030; formats and traps in docs/CONTEXT.md, "Signers without a NEAR account").

use near_api::NearToken;
use near_api::types::transaction::result::ExecutionFinalResult;
use near_sdk::base64::Engine as _;
use near_sdk::base64::engine::general_purpose::STANDARD as BASE64;
use near_sdk::serde_json::{Value, json};
use secp256k1::{Message, PublicKey, Secp256k1, SecretKey};
use sha2::Sha256;
use sha3::{Digest, Keccak256};

use super::{Env, INTENTS, OPTIONS};

/// Sends `execute_intents` and pays its gas. It holds nothing and decides nothing.
pub const RELAYER: &str = "relayer.sandbox";
/// `execute_intents` only checks that the deadline hasn't passed.
const DEADLINE: &str = "2030-01-01T00:00:00Z";

/// An EVM wallet: a secp256k1 key whose Intents account is its `0x` address.
pub struct EvmWallet {
    key: SecretKey,
    pub address: String,
}

impl EvmWallet {
    pub fn new(seed: u8) -> Self {
        let key = SecretKey::from_slice(&[seed; 32]).unwrap();
        let public = PublicKey::from_secret_key(&Secp256k1::new(), &key).serialize_uncompressed();
        let hash = Keccak256::digest(&public[1..]);
        let address = format!(
            "0x{}",
            hash[12..]
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        );
        Self { key, address }
    }

    /// An `erc191` payload for `execute_intents`: the JSON message `personal_sign`ed, with v
    /// brought down from 27/28 to the recovery id Intents reads.
    pub fn sign(&self, intents: Value, label: &str) -> Value {
        let nonce: [u8; 32] = Sha256::digest(label.as_bytes()).into();
        let payload = json!({
            "signer_id": self.address,
            "verifying_contract": INTENTS,
            "deadline": DEADLINE,
            "nonce": BASE64.encode(nonce),
            "intents": intents,
        })
        .to_string();
        let mut hasher = Keccak256::new();
        hasher.update(b"\x19Ethereum Signed Message:\n");
        hasher.update(payload.len().to_string());
        hasher.update(&payload);
        let digest = Message::from_slice(&hasher.finalize()).unwrap();
        let (recovery, rs) = Secp256k1::new()
            .sign_ecdsa_recoverable(&digest, &self.key)
            .serialize_compact();
        let mut signature = rs.to_vec();
        signature.push(u8::try_from(recovery.to_i32()).unwrap());
        json!({
            "standard": "erc191",
            "payload": payload,
            "signature": format!("secp256k1:{}", bs58::encode(signature).into_string()),
        })
    }
}

/// A `transfer` intent to this contract carrying a Warrant `msg` (create, write, buy, exercise).
pub fn to_options(token_id: &str, amount: u128, msg: Value) -> Value {
    json!({
        "intent": "transfer",
        "receiver_id": OPTIONS,
        "tokens": {token_id: amount.to_string()},
        "msg": msg.to_string(),
    })
}

/// An `auth_call` intent to this contract's `on_auth` (list, cancel, close, claims).
pub fn auth_call(msg: Value) -> Value {
    json!({"intent": "auth_call", "contract_id": OPTIONS, "msg": msg.to_string()})
}

impl Env {
    pub async fn relay(&self, signed: &Value) -> ExecutionFinalResult {
        self.call(
            RELAYER,
            INTENTS,
            "execute_intents",
            json!({"signed": [signed]}),
            NearToken::from_yoctonear(0),
        )
        .await
    }

    /// A relayed intent that must settle with no failed receipt anywhere in its tree.
    pub async fn ok_relay(&self, wallet: &EvmWallet, intent: Value, label: &str) {
        let result = self.relay(&wallet.sign(json!([intent]), label)).await;
        let failures = format!("{:?}", result.receipt_failures());
        assert!(
            result.receipt_failures().is_empty(),
            "{label} had failed receipts: {failures}"
        );
    }

    /// A relayed intent our contract refuses with `expected`.
    pub async fn refused_relay(
        &self,
        wallet: &EvmWallet,
        intent: Value,
        label: &str,
        expected: &str,
    ) {
        let result = self.relay(&wallet.sign(json!([intent]), label)).await;
        let failures = format!("{:?}", result.receipt_failures());
        assert!(
            failures.contains(expected),
            "{label}: expected {expected}, got {failures}"
        );
    }
}
