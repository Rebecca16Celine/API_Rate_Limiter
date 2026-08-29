import json
from pathlib import Path

from web3 import Web3

RPC_URL = "http://127.0.0.1:8545"
DEPLOYMENT_FILE = Path(__file__).parent / "deployment.json"

w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    raise ConnectionError(f"Cannot connect to blockchain at {RPC_URL}")

with open(DEPLOYMENT_FILE, "r") as file:
    deployment = json.load(file)

CONTRACT_ADDRESS = deployment["address"]
CONTRACT_ABI = deployment["abi"]

contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=CONTRACT_ABI
)

# accounts[0] is whoever deployed the contract, i.e. the admin
# (registerOrganization / updateQuota / updateOrganizationOwner all
# require this). It is NOT necessarily an organization's owner --
# submit_usage() needs to be called from that org's own owner address,
# so every write function below takes an optional from_account override.
ADMIN_ACCOUNT = w3.eth.accounts[0]


def to_organization_id(name: str) -> bytes:
    """Convert a human-readable org name into the bytes32 ID the contract
    expects. Deterministic, so the same name always maps to the same ID --
    just make sure callers agree on the exact string used."""
    if not isinstance(name, str) or not name:
        raise ValueError("Organization name must be a non-empty string")
    return Web3.keccak(text=name)


def _send(function_call, from_account):
    """Send a state-changing call and surface a clear failure if it doesn't
    succeed, instead of a bare receipt with status 0 or an opaque node error.

    Two distinct failure points are handled separately: transact() itself
    can raise before anything is even sent (e.g. gas estimation reverting,
    bad args, RPC/connection errors) -- that is not the same thing as a
    transaction that got mined but failed, so the two are not conflated
    into one misleading "reverted" message."""
    try:
        tx_hash = function_call.transact({"from": from_account})
    except Exception as exc:
        raise RuntimeError(f"Transaction could not be sent: {exc}") from exc

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    if receipt.status != 1:
        raise RuntimeError(
            f"Transaction mined but failed (status=0). "
            f"Tx hash: {receipt.transactionHash.hex()}"
        )

    return receipt


def get_organization(organization_id):
    registered, quota, used_quota, owner = contract.functions.getOrganization(
        organization_id
    ).call()
    return {
        "registered": registered,
        "quota": quota,
        "usedQuota": used_quota,
        "owner": owner,
    }


def register_organization(organization_id, owner, quota, from_account=None):
    return _send(
        contract.functions.registerOrganization(organization_id, owner, quota),
        from_account or ADMIN_ACCOUNT,
    )


def update_quota(organization_id, new_quota, from_account=None):
    return _send(
        contract.functions.updateQuota(organization_id, new_quota),
        from_account or ADMIN_ACCOUNT,
    )


def update_organization_owner(organization_id, new_owner, from_account=None):
    return _send(
        contract.functions.updateOrganizationOwner(organization_id, new_owner),
        from_account or ADMIN_ACCOUNT,
    )


def submit_usage(organization_id, period, reported_usage, from_account):
    """from_account must be the registered owner of organization_id, not
    the admin -- the contract enforces this with onlyOrganizationOwner."""
    commitment = Web3.solidity_keccak(
        ["bytes32", "uint256", "uint256"],
        [organization_id, period, reported_usage],
    )

    return _send(
        contract.functions.submitUsageCommitment(
            organization_id, period, commitment, reported_usage
        ),
        from_account,
    )


def get_usage_record(organization_id, period):
    commitment, timestamp, reported_usage = contract.functions.getUsageRecord(
        organization_id, period
    ).call()
    return {
        "commitment": commitment.hex(),
        "timestamp": timestamp,
        "reportedUsage": reported_usage,
    }


def verify_usage(organization_id, period, usage):
    return contract.functions.verifyUsage(organization_id, period, usage).call()


if __name__ == "__main__":
    print("Blockchain connected:", w3.is_connected())
    print("Chain ID:", w3.eth.chain_id)
    print("Contract address:", CONTRACT_ADDRESS)
    print("Admin account:", ADMIN_ACCOUNT)
