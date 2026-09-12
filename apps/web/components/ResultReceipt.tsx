import type { DemoRoomReceipt } from "@/lib/demo-data";

type ResultReceiptProps = {
  receipt: DemoRoomReceipt;
};

export function ResultReceipt({ receipt }: ResultReceiptProps) {
  return (
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Settlement Receipt
        </h2>
        <span className="badge badge-cyan">Verifiable Result</span>
      </div>

      <p className="receipt">{receipt.text}</p>

      <dl className="kv" style={{ marginTop: "1rem" }}>
        <div>
          <dt>Payout Status</dt>
          <dd>{receipt.payoutStatus}</dd>
        </div>
        <div>
          <dt>Winner Wallet</dt>
          <dd className="mono" style={{ fontSize: "0.8125rem" }}>{receipt.winnerWallet}</dd>
        </div>
        <div>
          <dt>Payout Tx</dt>
          <dd className="mono" style={{ fontSize: "0.8125rem" }}>{receipt.payoutTx}</dd>
        </div>
      </dl>
    </div>
  );
}