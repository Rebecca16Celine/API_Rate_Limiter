import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "";

function App() {
    const [dashboard, setDashboard] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchDashboard = async () => {
        try {
            setError("");

            const response = await fetch(
                `${API_URL}/api/dashboard`
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to fetch dashboard data"
                );
            }

            const data = await response.json();

            setDashboard(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();

        const interval = setInterval(
            fetchDashboard,
            5000
        );

        return () => clearInterval(interval);
    }, []);

    const organizations =
        Object.entries(dashboard);

    return (
        <div className="app">

            <header className="header">

                <div>
                    <h1>
                        API Usage Monitoring
                    </h1>

                    <p>
                        Independent gateway
                        metering & blockchain
                        verification
                    </p>
                </div>

                <button
                    className="refresh-button"
                    onClick={fetchDashboard}
                >
                    Refresh
                </button>

            </header>


            {loading && (
                <div className="message">
                    Loading dashboard...
                </div>
            )}


            {error && (
                <div className="error-box">
                    ⚠ {error}
                    <br />
                    Make sure the Node.js
                    backend is running on
                    port 5000.
                </div>
            )}


            {!loading &&
                !error &&
                organizations.length === 0 && (
                    <div className="message">
                        No organizations found.
                    </div>
                )}


            <main className="dashboard">

                {organizations.map(
                    ([name, data]) => {

                        const usagePercent =
                            data.quota > 0
                                ? Math.min(
                                    (
                                        data.gatewayObserved /
                                        data.quota
                                    ) * 100,
                                    100
                                )
                                : 0;

                        const isDiscrepancy =
                            data.status ===
                            "DISCREPANCY";

                        const isQuotaBreach =
                            data.status ===
                            "QUOTA_BREACH";


                        return (
                            <section
                                className="organization-card"
                                key={name}
                            >

                                <div className="card-header">

                                    <div>
                                        <h2>{name}</h2>

                                        <span className="subtitle">
                                            Usage Overview
                                        </span>
                                    </div>


                                    <span
                                        className={
                                            `status ${
                                                isQuotaBreach
                                                    ? "breach"
                                                    : isDiscrepancy
                                                        ? "discrepancy"
                                                        : "normal"
                                            }`
                                        }
                                    >
                                        {isQuotaBreach
                                            ? "⚠ QUOTA BREACH"
                                            : isDiscrepancy
                                                ? "⚠ DISCREPANCY"
                                                : "✓ NORMAL"}
                                    </span>

                                </div>


                                <div className="stats-grid">

                                    <div className="stat">
                                        <span>
                                            Gateway Observed
                                        </span>

                                        <strong>
                                            {data.gatewayObserved}
                                        </strong>
                                    </div>


                                    <div className="stat">
                                        <span>
                                            Organization Reported
                                        </span>

                                        <strong>
                                            {data.organizationReported}
                                        </strong>
                                    </div>


                                    <div className="stat">
                                        <span>
                                            HLL Estimate
                                        </span>

                                        <strong>
                                            {Number(
                                                data.hllEstimate
                                            ).toFixed(2)}
                                        </strong>
                                    </div>


                                    <div className="stat">
                                        <span>
                                            Difference
                                        </span>

                                        <strong
                                            className={
                                                data.difference > 0
                                                    ? "difference"
                                                    : ""
                                            }
                                        >
                                            {data.difference}
                                        </strong>
                                    </div>

                                </div>


                                <div className="quota-section">

                                    <div className="quota-label">

                                        <span>
                                            Quota Usage
                                        </span>

                                        <span>
                                            {
                                                data.gatewayObserved
                                            }{" "}
                                            /{" "}
                                            {data.quota}
                                        </span>

                                    </div>


                                    <div className="progress-bar">

                                        <div
                                            className={
                                                `progress ${
                                                    isQuotaBreach
                                                        ? "progress-breach"
                                                        : ""
                                                }`
                                            }
                                            style={{
                                                width:
                                                    `${usagePercent}%`
                                            }}
                                        />

                                    </div>

                                </div>


                                {isDiscrepancy && (
                                    <div className="alert discrepancy-alert">

                                        <strong>
                                            ⚠ Discrepancy
                                        </strong>

                                        <p>
                                            The gateway observed{" "}
                                            {
                                                data.gatewayObserved
                                            }{" "}
                                            requests, while the
                                            organization reported{" "}
                                            {
                                                data.organizationReported
                                            }.
                                        </p>

                                    </div>
                                )}


                                {isQuotaBreach && (
                                    <div className="alert breach-alert">

                                        <strong>
                                            ⚠ Quota Breach
                                        </strong>

                                        <p>
                                            Gateway-observed usage
                                            has reached or exceeded
                                            the organization's quota.
                                        </p>

                                    </div>
                                )}


                                <div className="blockchain-section">

                                    <h3>
                                        Blockchain Verification
                                    </h3>


                                    <div className="blockchain-grid">

                                        <div>
                                            <span>
                                                Status
                                            </span>

                                            <strong>
                                                ✓ Connected
                                            </strong>
                                        </div>


                                        <div>
                                            <span>
                                                Difference
                                            </span>

                                            <strong>
                                                {data.difference}
                                            </strong>
                                        </div>


                                        <div className="hash">

                                            <span>
                                                Bloom Hash
                                            </span>

                                            <code>
                                                {data.bloomHash}
                                            </code>

                                        </div>

                                    </div>

                                </div>

                            </section>
                        );
                    }
                )}

            </main>


            <footer>
                API Rate Limiter •
                Independent Usage Verification
            </footer>

        </div>
    );
}

export default App;