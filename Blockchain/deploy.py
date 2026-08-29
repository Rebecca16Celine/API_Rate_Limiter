import json
from pathlib import Path

from web3 import Web3
from solcx import compile_files, install_solc, set_solc_version, get_installed_solc_versions

RPC_URL = "http://127.0.0.1:8545"
SOLC_VERSION = "0.8.20"
CONTRACT_FILE = "UsageCommitment.sol"
CONTRACT_NAME = "UsageCommitment"
DEPLOYMENT_OUT = "deployment.json"

# Make sure the required compiler version is actually installed before
# trying to select it -- set_solc_version() alone assumes it's present
# and fails with a confusing error otherwise.
if SOLC_VERSION not in {str(v) for v in get_installed_solc_versions()}:
    print(f"solc {SOLC_VERSION} not found locally, installing...")
    install_solc(SOLC_VERSION)

set_solc_version(SOLC_VERSION)

compiled = compile_files(
    [CONTRACT_FILE],
    output_values=["abi", "bin"]
)

contract_data = compiled[f"{CONTRACT_FILE}:{CONTRACT_NAME}"]
abi = contract_data["abi"]
bytecode = contract_data["bin"]

w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    raise Exception(f"Could not connect to blockchain at {RPC_URL}")

# NOTE: this relies on the node providing unlocked, pre-funded accounts
# (e.g. Anvil/Hardhat/Ganache in dev mode). It will NOT work against a
# real network (mainnet/testnet/most RPC providers), since those don't
# expose accounts to sign with -- you'd need to load a private key and
# sign the transaction locally instead (see note at bottom).
account = w3.eth.accounts[0]

contract = w3.eth.contract(abi=abi, bytecode=bytecode)

print(f"Deploying {CONTRACT_NAME} from {account}...")

tx_hash = contract.constructor().transact({"from": account})
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

if receipt.status != 1:
    raise Exception(f"Deployment transaction failed. Receipt: {receipt}")

print("Deployment successful!")
print("Contract address:", receipt.contractAddress)
print("Deployer:", account)
print("Transaction hash:", receipt.transactionHash.hex())
print("Gas used:", receipt.gasUsed)

# Persist ABI + address so other scripts (interaction, tests, front-end)
# don't need to recompile or hardcode the address.
deployment_info = {
    "contractName": CONTRACT_NAME,
    "address": receipt.contractAddress,
    "deployer": account,
    "transactionHash": receipt.transactionHash.hex(),
    "abi": abi,
}

Path(DEPLOYMENT_OUT).write_text(json.dumps(deployment_info, indent=2))
print(f"Deployment info written to {DEPLOYMENT_OUT}")

# --- Deploying to a real network instead of a local dev node ---
# Replace the account/transact block above with something like:
#
#   from eth_account import Account
#   acct = Account.from_key(PRIVATE_KEY)          # never hardcode this; load from env
#   tx = contract.constructor().build_transaction({
#       "from": acct.address,
#       "nonce": w3.eth.get_transaction_count(acct.address),
#       "gas": 3_000_000,
#       "gasPrice": w3.eth.gas_price,
#   })
#   signed = acct.sign_transaction(tx)
#   tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
#   receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
