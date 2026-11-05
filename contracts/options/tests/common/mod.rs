//! Shared sandbox harness: byte-identical mainnet `intents.near` and `wrap.near` (fetched over
//! RPC, hash-pinned), the sandbox-only tUSDC test token, and this contract, wired together.
#![allow(dead_code)] // each test binary uses a different subset

pub mod evm;

use std::path::PathBuf;
use std::sync::Arc;

use near_api::types::transaction::result::ExecutionFinalResult;
use near_api::{AccountId, Contract, NearGas, NearToken, NetworkConfig, Signer};
use near_sdk::base64::Engine as _;
use near_sdk::base64::engine::general_purpose::STANDARD as BASE64;
use near_sdk::serde_json::{Value, json};
use sha2::{Digest, Sha256};

/// Code hashes of the live mainnet deployments (docs/CONTEXT.md). If mainnet upgrades, setup fails
/// on purpose: re-verify the new code before trusting it.
const INTENTS_CODE_HASH: &str = "BtA1BEFNS619KkvXFsgcpQ21Tb5yMm32aaUkn7xNothk";
const WNEAR_CODE_HASH: &str = "DL2f5xmZ44cQRP6vBMt94rvseH5d5KKnAGis2WkTAsh1";
const MAINNET_RPC: &str = "https://free.rpc.fastnear.com";

pub const OPTIONS: &str = "options.sandbox";
pub const INTENTS: &str = "intents.sandbox";
pub const WNEAR: &str = "nep141:wrap.sandbox";
pub const TUSDC: &str = "nep141:tusdc.sandbox";
/// One whole token in base units.
pub const WNEAR_ONE: u128 = 1_000_000_000_000_000_000_000_000;
pub const TUSDC_ONE: u128 = 1_000_000;
pub const YOCTO: NearToken = NearToken::from_yoctonear(1);

pub struct Env {
    pub sandbox: near_sandbox::Sandbox,
    pub net: NetworkConfig,
    pub signer: Arc<Signer>,
}

impl Env {
    pub async fn call(
        &self,
        signer_id: &str,
        contract: &str,
        method: &str,
        args: Value,
        deposit: NearToken,
    ) -> ExecutionFinalResult {
        Contract(id(contract))
            .call_function(method, args)
            .transaction()
            .deposit(deposit)
            .gas(NearGas::from_tgas(300))
            .with_signer(id(signer_id), self.signer.clone())
            .send_to(&self.net)
            .await
            .expect("transaction sent")
            .into_full()
            .expect("final execution result")
    }

    /// A call that must succeed with no failed receipt anywhere in its tree.
    pub async fn ok(
        &self,
        signer_id: &str,
        contract: &str,
        method: &str,
        args: Value,
        deposit: NearToken,
    ) {
        let result = self.call(signer_id, contract, method, args, deposit).await;
        let failures = format!("{:?}", result.receipt_failures());
        assert!(
            result.receipt_failures().is_empty(),
            "{method} had failed receipts: {failures}"
        );
        result.assert_success();
    }

    /// `intents.mt_transfer_call` of `amount` of `token_id` to this contract with `msg`.
    pub async fn via_intents(
        &self,
        signer_id: &str,
        token_id: &str,
        amount: u128,
        msg: Value,
    ) -> ExecutionFinalResult {
        self.call(
            signer_id,
            INTENTS,
            "mt_transfer_call",
            json!({
                "receiver_id": OPTIONS,
                "token_id": token_id,
                "amount": amount.to_string(),
                "approval": null,
                "memo": null,
                "msg": msg.to_string(),
            }),
            YOCTO,
        )
        .await
    }

    pub async fn ok_via_intents(&self, signer_id: &str, token_id: &str, amount: u128, msg: Value) {
        let result = self.via_intents(signer_id, token_id, amount, msg).await;
        let failures = format!("{:?}", result.receipt_failures());
        assert!(
            result.receipt_failures().is_empty(),
            "action via Intents had failed receipts: {failures}"
        );
    }

    /// An action through Intents that our contract refuses: the transaction succeeds (Intents
    /// refunds), but our receipt fails with `expected`.
    pub async fn refused_via_intents(
        &self,
        signer_id: &str,
        token_id: &str,
        amount: u128,
        msg: Value,
        expected: &str,
    ) {
        let result = self.via_intents(signer_id, token_id, amount, msg).await;
        let failures = format!("{:?}", result.receipt_failures());
        assert!(
            failures.contains(expected),
            "expected {expected}, got: {failures}"
        );
    }

    pub async fn view<T: near_sdk::serde::de::DeserializeOwned + Send + Sync>(
        &self,
        contract: &str,
        method: &str,
        args: Value,
    ) -> T {
        Contract(id(contract))
            .call_function(method, args)
            .read_only()
            .fetch_from(&self.net)
            .await
            .expect("view call")
            .data
    }

    /// Balance of `account` inside Intents.
    pub async fn intents_balance(&self, account: &str, token_id: &str) -> u128 {
        let amount: String = self
            .view(
                INTENTS,
                "mt_balance_of",
                json!({"account_id": account, "token_id": token_id}),
            )
            .await;
        amount.parse().unwrap()
    }

    /// Longs of `series` held in this contract's ledger.
    pub async fn longs(&self, account: &str, series: &str) -> u128 {
        let amount: String = self
            .view(
                OPTIONS,
                "mt_balance_of",
                json!({"account_id": account, "token_id": series}),
            )
            .await;
        amount.parse().unwrap()
    }

    pub async fn series(&self, series: u64) -> Value {
        self.view(
            OPTIONS,
            "get_series",
            json!({"series_id": series.to_string()}),
        )
        .await
    }

    /// Wraps `amount` NEAR into wNEAR and deposits it into Intents for `who`.
    pub async fn fund_wnear(&self, who: &str, amount: u128) {
        self.register(who, "wrap.sandbox").await;
        self.ok(
            who,
            "wrap.sandbox",
            "near_deposit",
            json!({}),
            NearToken::from_yoctonear(amount),
        )
        .await;
        self.deposit_into_intents(who, "wrap.sandbox", amount).await;
    }

    /// Sends `amount` tUSDC from the token treasury to `who` and deposits it into Intents.
    pub async fn fund_tusdc(&self, who: &str, amount: u128) {
        self.register(who, "tusdc.sandbox").await;
        self.ok(
            "tusdc.sandbox",
            "tusdc.sandbox",
            "ft_transfer",
            json!({"receiver_id": who, "amount": amount.to_string()}),
            YOCTO,
        )
        .await;
        self.deposit_into_intents(who, "tusdc.sandbox", amount)
            .await;
    }

    pub async fn register(&self, who: &str, token: &str) {
        self.ok(
            who,
            token,
            "storage_deposit",
            json!({"account_id": who, "registration_only": true}),
            NearToken::from_millinear(100),
        )
        .await;
    }

    async fn deposit_into_intents(&self, who: &str, token: &str, amount: u128) {
        self.ok(
            who,
            token,
            "ft_transfer_call",
            json!({"receiver_id": INTENTS, "amount": amount.to_string(), "msg": ""}),
            YOCTO,
        )
        .await;
    }

    /// Advances blocks until series `series` reports `expired`.
    pub async fn wait_until_expired(&self, series: u64) {
        for _ in 0..40 {
            if self.series(series).await["expired"].as_bool().unwrap() {
                return;
            }
            self.sandbox.fast_forward(100).await.expect("fast forward");
        }
        panic!("series {series} did not expire");
    }
}

pub fn id(name: &str) -> AccountId {
    name.parse().unwrap()
}

pub fn field(value: &Value, key: &str) -> u128 {
    value[key].as_str().unwrap().parse().unwrap()
}

pub fn now_ns() -> u64 {
    u64::try_from(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
    )
    .unwrap()
}

pub const SECOND_NS: u64 = 1_000_000_000;

/// `msg` for a new series.
pub fn create_msg(
    kind: &str,
    underlying_per_option: u128,
    strike_per_option: u128,
    expiry_ns: u64,
) -> Value {
    json!({
        "action": "create",
        "kind": kind,
        "underlying": WNEAR,
        "quote": TUSDC,
        "underlying_per_option": underlying_per_option.to_string(),
        "strike_per_option": strike_per_option.to_string(),
        "expiry_ns": expiry_ns.to_string(),
    })
}

fn code_hash(code: &[u8]) -> String {
    bs58::encode(Sha256::digest(code)).into_string()
}

/// Fetches `account`'s code from mainnet (cached under target/), verified against `expected_hash`.
async fn mainnet_wasm(account: &str, expected_hash: &str) -> Vec<u8> {
    let cache: PathBuf = [
        env!("CARGO_MANIFEST_DIR"),
        "target",
        "mainnet-wasm",
        &format!("{account}.wasm"),
    ]
    .iter()
    .collect();
    if let Ok(code) = std::fs::read(&cache)
        && code_hash(&code) == expected_hash
    {
        return code;
    }
    let mainnet = NetworkConfig::from_rpc_url("mainnet", MAINNET_RPC.parse().unwrap());
    let view = Contract(id(account))
        .wasm()
        .fetch_from(&mainnet)
        .await
        .expect("fetch mainnet code");
    let code = BASE64.decode(view.data.code_base64).expect("base64 code");
    assert_eq!(
        code_hash(&code),
        expected_hash,
        "{account} on mainnet no longer matches the pinned code hash: re-verify before updating it"
    );
    std::fs::create_dir_all(cache.parent().unwrap()).unwrap();
    std::fs::write(&cache, &code).unwrap();
    code
}

/// Builds a contract crate with cargo-near and returns its wasm.
fn build(manifest: &str, abi_features: Option<&str>) -> Vec<u8> {
    let opts = cargo_near_build::BuildOpts {
        manifest_path: Some(cargo_near_build::camino::Utf8PathBuf::from(manifest)),
        abi_features: abi_features.map(str::to_string),
        ..Default::default()
    };
    std::fs::read(cargo_near_build::build_with_cli(opts).expect("build contract")).unwrap()
}

async fn create_account(sandbox: &near_sandbox::Sandbox, name: &str, near: u128) {
    sandbox
        .create_account(id(name))
        .initial_balance(NearToken::from_near(near))
        .send()
        .await
        .expect("create account");
}

async fn deploy(env: &Env, account: &str, code: Vec<u8>, init: &str, args: Value) {
    Contract::deploy(id(account))
        .use_code(code)
        .with_init_call(init, args)
        .unwrap()
        .with_signer(env.signer.clone())
        .send_to(&env.net)
        .await
        .expect("deploy")
        .assert_success();
}

/// Deploys Intents (mainnet bytecode), wNEAR (mainnet bytecode), tUSDC (test token) and this
/// contract; allowlists both tokens. Accounts: alice, bob, carol (users), owner (allowlist),
/// relayer (pays gas for signed intents).
pub async fn setup() -> Env {
    setup_with(near_sandbox::config::SandboxConfig::default()).await
}

/// `setup` on a sandbox started with `config` (the devnet keeps its history this way).
pub async fn setup_with(config: near_sandbox::config::SandboxConfig) -> Env {
    let sandbox = near_sandbox::Sandbox::start_sandbox_with_config(config)
        .await
        .expect("sandbox");
    let net = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse().unwrap());
    let signer = Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
            .parse()
            .unwrap(),
    )
    .unwrap();
    let env = Env {
        sandbox,
        net,
        signer,
    };

    for (name, near) in [
        (INTENTS, 50),
        ("wrap.sandbox", 10),
        ("tusdc.sandbox", 10),
        (OPTIONS, 20),
        ("owner.sandbox", 10),
        ("alice.sandbox", 10_000),
        ("bob.sandbox", 1_000),
        ("carol.sandbox", 1_000),
        // Pays the gas for intents signed by wallets without a NEAR account (D-030).
        ("relayer.sandbox", 100),
    ] {
        create_account(&env.sandbox, name, near).await;
    }

    deploy(
        &env,
        "wrap.sandbox",
        mainnet_wasm("wrap.near", WNEAR_CODE_HASH).await,
        "new",
        json!({}),
    )
    .await;
    deploy(
        &env,
        "tusdc.sandbox",
        build(
            concat!(env!("CARGO_MANIFEST_DIR"), "/../test-token/Cargo.toml"),
            None,
        ),
        "new",
        json!({"owner_id": "tusdc.sandbox", "total_supply": (10_000_000 * TUSDC_ONE).to_string()}),
    )
    .await;
    deploy(
        &env,
        INTENTS,
        mainnet_wasm("intents.near", INTENTS_CODE_HASH).await,
        "new",
        json!({"config": {"wnear_id": "wrap.sandbox", "fees": {"fee": 1, "fee_collector": INTENTS}, "roles": {}}}),
    )
    .await;
    for token in ["wrap.sandbox", "tusdc.sandbox"] {
        env.register(INTENTS, token).await;
    }
    deploy(
        &env,
        OPTIONS,
        build(
            concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml"),
            Some("abi"),
        ),
        "new",
        json!({"owner_id": "owner.sandbox", "intents_id": INTENTS, "retire_after_ns": (now_ns() + 30 * SECOND_NS).to_string()}),
    )
    .await;
    for (token, min) in [(WNEAR, WNEAR_ONE / 10), (TUSDC, TUSDC_ONE / 10)] {
        env.ok(
            "owner.sandbox",
            OPTIONS,
            "allow_token",
            json!({"token_id": token, "min_amount": min.to_string()}),
            YOCTO,
        )
        .await;
    }
    env
}
