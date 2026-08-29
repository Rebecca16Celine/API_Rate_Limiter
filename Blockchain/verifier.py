from blockchain_client import (
    to_organization_id,
    get_usage_record,
    verify_usage,
)


def verify_usage_claim(organization_name, period, claimed_usage):
    organization_id = to_organization_id(organization_name)

    try:
        record = get_usage_record(organization_id, period)
    except Exception as exc:
        # get_usage_record's underlying contract call reverts if the org
        # isn't registered or has no record for this period -- without
        # this, that surfaces as an opaque web3/ContractLogicError trace
        # instead of a message someone auditing usage can act on.
        print("Organization:", organization_name)
        print("Period:", period)
        print(f"Could not read usage record: {exc}")
        return None

    verified = verify_usage(organization_id, period, claimed_usage)

    print("Organization:", organization_name)
    print("Period:", period)
    print("Claimed usage:", claimed_usage)
    print("Stored usage:", record["reportedUsage"])
    print("Commitment:", record["commitment"])
    print("Verified:", verified)

    return verified


if __name__ == "__main__":
    verify_usage_claim(
        "BankA",
        1,
        250
    )
