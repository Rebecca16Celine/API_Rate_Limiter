from blockchain_client import (
    to_organization_id,
    get_organization,
    register_organization,
    submit_usage,
    get_usage_record,
    verify_usage,
    ADMIN_ACCOUNT,
)

ORG_ID = to_organization_id("BankA")
QUOTA = 1000
USAGE = 250
PERIOD = 1


def main():
    print("1. Registering organization...")
    register_organization(
        ORG_ID,
        ADMIN_ACCOUNT,
        QUOTA
    )
    print("Organization registered.")

    print("\n2. Checking organization...")
    print(get_organization(ORG_ID))

    print("\n3. Submitting usage...")
    submit_usage(
        ORG_ID,
        PERIOD,
        USAGE,
        ADMIN_ACCOUNT
    )
    print("Usage submitted.")

    print("\n4. Reading usage record...")
    print(get_usage_record(ORG_ID, PERIOD))

    print("\n5. Verifying usage...")
    print("Usage verified:", verify_usage(ORG_ID, PERIOD, USAGE))
if __name__ == "__main__":
    main()
