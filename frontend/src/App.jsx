import { useEffect, useState } from "react";
import "./App.css";

function App() {
    const [dashboard, setDashboard] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Fetch dashboard data
    const fetchDashboard = async () => {
        try {
            const response = await fetch("/api/dashboard");

            if (!response.ok) {
                throw new Error("Failed to fetch dashboard");
            }

            const data = await response.json();

            setDashboard(data);
            setError("");
        } catch (err) {
            console.error(err);
            setError("Unable to connect to API Gateway");
        } finally {
            setLoading(false);
        }
    };


    // Send request through API Gateway
    const sendRequest = async (
        organization,
        shouldReport
    ) => {
        try {
            setError("");

            const response = await fetch(
                `/api/request/${encodeURIComponent(organization)}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        requestId:
                            `request-${Date.now()}-${Math.random()}`,
                        shouldReport
                    })
                }
            );

            if (!response.ok) {
                throw new Error("Failed to send request");
            }

            await fetchDashboard();

        } catch (err) {
            console.error(err);
            setError("Unable to send request");
        }
    };


    // Load dashboard and refresh every 2 seconds
    useEffect(() => {
        fetchDashboard();

        const interval = setInterval(
            fetchDashboard,
            2000
        );

        return () => clearInterval(interval);
    }, []);


    if (loading) {
        return (
            <div className="app">
                <h1>Loading dashboard...</h1>
            </div>
        );
    }


    return (
        <div className="app">

            {/* Header */}

            <header className="header">

                <h1>
                    Decentralized API Quota Dashboard
                </h1>

                <p>
                    Independent Gateway Usage Verification
                </p>

            </header>


            {/* Error */}

            {error && (
                <div className="error">
                    ⚠ {error}
                </div>
            )}


            {/* Organization cards */}

            <main className="dashboard">

                {Object.entries(dashboard).map(
                    ([name, org]) => {

                        const isDiscrepancy =
                            org.status === "DISCREPANCY";

                        const isBreach =
                            org.status === "QUOTA_BREACH";


                        // Calculate quota percentage
                        const usagePercentage =
                            org.quota > 0
                                ? Math.min(
                                    (org.organizationReported /
                                        org.quota) * 100,
                                    100
                                )
                                : 0;


                        return (
                            <div
                                className="org-card"
                                key={name}
                            >

                                {/* Organization */}

                                <h2>{name}</h2>


                                {/* Quota */}

                                <div className="metric">

                                    <span>
                                        Quota
                                    </span>

                                    <strong>
                                        {org.quota.toLocaleString()}
                                    </strong>

                                </div>


                                {/* Gateway */}

                                <div className="metric">

                                    <span>
                                        Gateway observed
                                    </span>

                                    <strong>
                                        {org.gatewayObserved.toLocaleString()}
                                    </strong>

                                </div>


                                {/* Organization reported */}

                                <div className="metric">

                                    <span>
                                        Organization reported
                                    </span>

                                    <strong>
                                        {org.organizationReported.toLocaleString()}
                                    </strong>

                                </div>


                                {/* HLL */}

                                <div className="metric">

                                    <span>
                                        HLL unique estimate
                                    </span>

                                    <strong>
                                        ~
                                        {Number(
                                            org.hllEstimate
                                        ).toFixed(2)}
                                    </strong>

                                </div>


                                {/* Quota usage */}

                                <div className="quota-section">

                                    <div className="quota-header">

                                        <span>
                                            Quota usage
                                        </span>

                                        <strong>
                                            {
                                                org.organizationReported.toLocaleString()
                                            }
                                            {" / "}
                                            {
                                                org.quota.toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div className="progress-bar">

                                        <div
                                            className="progress-fill"
                                            style={{
                                                width:
                                                    `${usagePercentage}%`
                                            }}
                                        />

                                    </div>


                                    <div className="percentage">

                                        {usagePercentage.toFixed(2)}%

                                    </div>

                                </div>


                                <hr />


                                {/* Request buttons */}

                                <div className="buttons">

                                    <button
                                        className="normal-button"
                                        onClick={() =>
                                            sendRequest(
                                                name,
                                                true
                                            )
                                        }
                                    >
                                        Send Normal Request
                                    </button>


                                    <button
                                        className="unreported-button"
                                        onClick={() =>
                                            sendRequest(
                                                name,
                                                false
                                            )
                                        }
                                    >
                                        Send Unreported Request
                                    </button>

                                </div>


                                {/* Difference */}

                                <div className="difference">

                                    <span>
                                        Difference
                                    </span>

                                    <strong>
                                        {org.difference.toLocaleString()}
                                    </strong>

                                </div>


                                {/* Status */}

                                <div
                                    className={
                                        "status " +
                                        (
                                            isDiscrepancy ||
                                            isBreach
                                                ? "alert"
                                                : "normal"
                                        )
                                    }
                                >

                                    {isBreach && (
                                        <>
                                            🚨 QUOTA BREACH
                                        </>
                                    )}

                                    {!isBreach &&
                                        isDiscrepancy && (
                                            <>
                                                ⚠ DISCREPANCY
                                            </>
                                        )}

                                    {!isDiscrepancy &&
                                        !isBreach && (
                                            <>
                                                ✓ NORMAL
                                            </>
                                        )}

                                </div>

                            </div>
                        );
                    }
                )}

            </main>

        </div>
    );
}

export default App;