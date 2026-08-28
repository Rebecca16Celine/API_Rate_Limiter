const BloomFilter = require("./bloomFilter");
const HyperLogLog = require("./hyperLogLog");


class Organization {

    constructor(name, quota = 10000) {

        this.name = name;
        this.quota = quota;

        // Member 1's data structures
        this.bloomFilter = new BloomFilter();
        this.hll = new HyperLogLog();

        // Number of requests that the
        // organization reports
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


        /*
         * Add request to Bloom Filter.
         */

        this.bloomFilter.add(requestId);


        /*
         * Add request to HyperLogLog.
         */

        this.hll.add(requestId);


        /*
         * Increase organization's reported
         * request count.
         */

        this.reportedRequests++;


        return {
            reported: true,
            requestId: requestId
        };
    }


    getUsage() {

        return {
            organization: this.name,

            quota: this.quota,

            reportedRequests:
                this.reportedRequests,

            hllEstimate:
                this.hll.estimate()
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