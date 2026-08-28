class GatewayMeter {
    constructor() {
        // Total number of requests received by the gateway
        this.totalRequests = 0;

        // Request count for each organization
        this.organizationUsage = new Map();
    }

    recordRequest(organization) {

        // The gateway ALWAYS counts the request
        this.totalRequests++;

        // Create entry for a new organization
        if (!this.organizationUsage.has(organization)) {
            this.organizationUsage.set(organization, 0);
        }

        // Increase organization's actual gateway count
        const currentCount =
            this.organizationUsage.get(organization);

        this.organizationUsage.set(
            organization,
            currentCount + 1
        );

        return {
            organization: organization,
            gatewayObserved:
                this.organizationUsage.get(organization)
        };
    }

    getOrganizationUsage(organization) {

        return this.organizationUsage.get(
            organization
        ) || 0;
    }

    getTotalRequests() {

        return this.totalRequests;
    }

    getAllUsage() {

        const result = {};

        for (
            const [organization, count]
            of this.organizationUsage
        ) {
            result[organization] = count;
        }

        return result;
    }
}

module.exports = GatewayMeter;