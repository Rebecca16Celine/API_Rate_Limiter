import json
from pathlib import Path

from web3 import Web3


RPC_URL = "http://127.0.0.1:8545"
DEPLOYMENT_FILE = Path(__file__).parent / "deployment.json"

w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    raise ConnectionError(
        f"Cannot connect to blockchain at {RPC_URL}"
    )


with open(DEPLOYMENT_FILE, "r") as file:
    deployment = json.load(file)


CONTRACT_ADDRESS = deployment["address"]
CONTRACT_ABI = deployment["abi"]

contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=CONTRACT_ABI
)


# Read the admin/gateway addresses that were actually used at deploy time,
# rather than re-guessing accounts[0]/accounts[1]. On a single persistent
# local Anvil instance these are usually the same thing, but if the node
# is ever restarted with a different account order, or a different
# gateway is designated later via updateGateway(), hardcoding here would
# silently point at the wrong address instead of failing loudly.
ADMIN_ACCOUNT = deployment.get("admin", w3.eth.accounts[0])
GATEWAY_ACCOUNT = deployment.get("gateway", w3.eth.accounts[1])


def to_organization_id(name: str) -> bytes:
    """
    Convert organization name to deterministic bytes32 ID.
    """

    if not isinstance(name, str) or not name:
        raise ValueError(
            "Organization name must be a non-empty string"
        )

    return Web3.keccak(text=name)


def to_period_id(period: str) -> bytes:
    """
    Convert a period such as:
        2026-08-29T15:52

    into a deterministic bytes32 ID.
    """

    if not isinstance(period, str) or not period:
        raise ValueError(
            "Period must be a non-empty string"
        )

    return Web3.keccak(text=period)


def _to_bytes32(value) -> bytes:
    """
    Normalize a bloom hash into exactly 32 raw bytes, whether it arrives
    as bytes already or as a hex string (with or without a leading 0x).
    Used everywhere a bloomHash is submitted or checked, so both paths
    apply the same validation instead of drifting apart.
    """

    if isinstance(value, (bytes, bytearray)):
        raw = bytes(value)
    elif isinstance(value, str):
        hex_str = value[2:] if value.startswith("0x") else value
        try:
            raw = bytes.fromhex(hex_str)
        except ValueError as exc:
            raise ValueError(f"bloomHash is not valid hex: {exc}") from exc
    else:
        raise TypeError("bloomHash must be bytes or a hex string")

    if len(raw) != 32:
        raise ValueError(
            f"bloomHash must be exactly 32 bytes, got {len(raw)}"
        )

    return raw


def _send(function_call, from_account):
    """
    Send a blockchain transaction and wait for confirmation.
    """

    try:
        tx_hash = function_call.transact(
            {"from": from_account}
        )
    except Exception as exc:
        raise RuntimeError(
            f"Transaction could not be sent: {exc}"
        ) from exc

    receipt = w3.eth.wait_for_transaction_receipt(
        tx_hash
    )

    if receipt.status != 1:
        raise RuntimeError(
            "Transaction mined but failed. "
            f"Tx hash: {receipt.transactionHash.hex()}"
        )

    return receipt


# --------------------------------------------------
# Organization management
# --------------------------------------------------

def register_organization(
    organization_name,
    owner,
    quota=10000,
    from_account=None
):
    organization_id = to_organization_id(
        organization_name
    )

    receipt = _send(
        contract.functions.registerOrganization(
            organization_id,
            owner,
            quota
        ),
        from_account or ADMIN_ACCOUNT
    )

    return {
        "organizationId": organization_id.hex(),
        "owner": owner,
        "quota": quota,
        "transactionHash":
            receipt.transactionHash.hex(),
        "blockNumber": receipt.blockNumber
    }


def get_organization(organization_name):
    organization_id = to_organization_id(
        organization_name
    )

    # Contract order is (registered, owner, quota, usedQuota) --
    # unpack in that exact order, not (registered, quota, used_quota, owner).
    (
        registered,
        owner,
        quota,
        used_quota
    ) = contract.functions.getOrganization(
        organization_id
    ).call()

    return {
        "organization": organization_name,
        "organizationId": organization_id.hex(),
        "registered": registered,
        "quota": quota,
        "usedQuota": used_quota,
        "owner": owner
    }


# --------------------------------------------------
# Gateway observation
# --------------------------------------------------

def submit_gateway_observation(
    organization_name,
    period,
    gateway_observed,
    hll_estimate,
    bloom_hash,
    from_account=None
):
    """
    Submit the gateway's independently observed usage.

    The gateway is responsible for:
      - gatewayObserved
      - hllEstimate
      - bloomHash
    """

    organization_id = to_organization_id(
        organization_name
    )

    period_id = to_period_id(period)
    bloom_hash = _to_bytes32(bloom_hash)

    receipt = _send(
        contract.functions.submitGatewayObservation(
            organization_id,
            period_id,
            gateway_observed,
            hll_estimate,
            bloom_hash
        ),
        from_account or GATEWAY_ACCOUNT
    )

    return {
        "organization": organization_name,
        "period": period,
        "gatewayObserved": gateway_observed,
        "hllEstimate": hll_estimate,
        "bloomHash": "0x" + bloom_hash.hex(),
        "transactionHash":
            receipt.transactionHash.hex(),
        "blockNumber": receipt.blockNumber
    }


# --------------------------------------------------
# Organization reported usage
# --------------------------------------------------

def submit_organization_report(
    organization_name,
    period,
    organization_reported,
    from_account
):
    """
    Submit the organization's reported usage.
    """

    organization_id = to_organization_id(
        organization_name
    )

    period_id = to_period_id(period)

    receipt = _send(
        contract.functions.submitOrganizationReport(
            organization_id,
            period_id,
            organization_reported
        ),
        from_account
    )

    return {
        "organization": organization_name,
        "period": period,
        "organizationReported":
            organization_reported,
        "transactionHash":
            receipt.transactionHash.hex(),
        "blockNumber": receipt.blockNumber
    }


# --------------------------------------------------
# Read usage record
# --------------------------------------------------

def get_usage_record(
    organization_name,
    period
):
    organization_id = to_organization_id(
        organization_name
    )

    period_id = to_period_id(period)

    # Contract returns 10 values in this exact order -- the previous
    # version of this function only unpacked 9, which raised
    # "too many values to unpack" on every call.
    (
        gateway_observed,
        organization_reported,
        hll_estimate,
        bloom_hash,
        difference,
        discrepancy,
        org_timestamp,
        gateway_timestamp,
        organization_submitted,
        gateway_submitted
    ) = contract.functions.getUsageRecord(
        organization_id,
        period_id
    ).call()

    return {
        "organization":
            organization_name,

        "period":
            period,

        "gatewayObserved":
            gateway_observed,

        "organizationReported":
            organization_reported,

        "hllEstimate":
            hll_estimate,

        "bloomHash":
            "0x" + bloom_hash.hex(),

        "difference":
            difference,

        "discrepancy":
            discrepancy,

        "gatewaySubmitted":
            gateway_submitted,

        "organizationSubmitted":
            organization_submitted,

        "organizationTimestamp":
            org_timestamp,

        "gatewayTimestamp":
            gateway_timestamp
    }


# --------------------------------------------------
# Verification
# --------------------------------------------------

def verify_usage(
    organization_name,
    period,
    gateway_observed,
    organization_reported,
    hll_estimate,
    bloom_hash
):
    organization_id = to_organization_id(
        organization_name
    )

    period_id = to_period_id(period)
    bloom_hash = _to_bytes32(bloom_hash)

    return contract.functions.verifyUsage(
        organization_id,
        period_id,
        gateway_observed,
        organization_reported,
        hll_estimate,
        bloom_hash
    ).call()


# --------------------------------------------------
# Simple connection test
# --------------------------------------------------

if __name__ == "__main__":

    print(
        "Blockchain connected:",
        w3.is_connected()
    )

    print(
        "Chain ID:",
        w3.eth.chain_id
    )

    print(
        "Contract address:",
        CONTRACT_ADDRESS
    )

    print(
        "Admin account:",
        ADMIN_ACCOUNT
    )

    print(
        "Gateway account:",
        GATEWAY_ACCOUNT
    )
