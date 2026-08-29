const crypto = require("crypto");

const BloomFilter = require("./bloomFilter");
const HyperLogLog = require("./hyperLogLog");


class Organization {

    constructor(name, quota = 10000) {

        this.name = name;
        this.quota = quota;

        // Member 1's data structures
        this.bloomFilter = new BloomFilter();
        this.hll = new HyperLogLog();

        // Number of requests reported
        // by the organization
        this.reportedRequests = 0;
    }


    recordRequest(requestId, shouldReport = true) {

        /*
         * The organization receives the request.
         *
         * shouldReport is used only for our
         * demonstration of a discrepancy.
         */

        if (!shouldReport) {

            return {
                reported: false,
                message:
                    "Organization did not report this request"
            };
        }


        // Add request to Bloom Filter
        this.bloomFilter.add(requestId);


        // Add request to HyperLogLog
        this.hll.add(requestId);


        // Increase reported request count
        this.reportedRequests++;


        return {
            reported: true,
            requestId: requestId
        };
    }


    /*
     * Generate a 32-byte SHA-256 hash of the
     * current Bloom Filter state.
     *
     * This is what will be submitted to the
     * blockchain as bloomHash.
     */

    getBloomHash() {

        return crypto
            .createHash("sha256")
            .update(Buffer.from(this.bloomFilter.bits))
            .digest("hex");
    }


    getUsage() {

        return {
            organization: this.name,

            quota: this.quota,

            reportedRequests:
                this.reportedRequests,

            hllEstimate:
                this.hll.estimate(),

            bloomHash:
                "0x" + this.getBloomHash()
        };
    }


    getQuotaStatus() {

        if (
            this.reportedRequests >=
            this.quota
        ) {

            return "QUOTA_BREACH";
        }

        return "WITHIN_QUOTA";
    }
}


module.exports = Organization;