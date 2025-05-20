import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { StreamflowSui } from "@streamflow/stream";
import BN from "bn.js";

const streamflowClient = new StreamflowSui.SuiStreamClient(
  "https://fullnode.mainnet.sui.io"
);

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

// Helper to convert BN to string with 9 decimals
function formatBNToDecimalString(bn: BN): string {
  const str = bn.toString().padStart(10, "0");
  const intPart = str.slice(0, str.length - 9) || "0";
  const decPart = str.slice(str.length - 9).padStart(9, "0");
  return `${intPart}.${decPart}`.replace(/^0+([1-9])/, "$1"); // remove leading zeros
}

// input parameters: treasury address: string, coin type: string
// returns: circulation: number (9 decimal precision)
export async function getCirculation(
  treasuryAddress: string,
  coinType: string
) {
  const response = await fetch(
    `https://api.streamflow.finance/v1/api/chain/6/contracts?address=${treasuryAddress}`,
    {
      headers: {
        accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contracts = await response.json();

  const suiContracts = contracts.data.filter(
    (contract: any) => contract.token === coinType
  );

  let totalWithdrawn = new BN(0);
  let totalDeposited = new BN(0);

  for (const contract of suiContracts) {
    try {
      const stream = await streamflowClient.getOne({ id: contract.address });
      totalWithdrawn = totalWithdrawn.add(stream.withdrawnAmount);
      totalDeposited = totalDeposited.add(stream.depositedAmount);
    } catch (error) {
      console.error(`Error fetching stream ${contract.address}:`, error);
    }
  }

  const coinList = await client.getCoins({
    owner: treasuryAddress,
    coinType: coinType,
  });

  if (coinList.data.length === 0) {
    throw new Error("No coins found");
  }

  let totalBalance = new BN(0);
  coinList.data.forEach((coin) => {
    totalBalance = totalBalance.add(new BN(coin.balance));
  });

  const totalSupply = new BN(12800000000).mul(new BN(10).pow(new BN(9))); // 12.8B * 10^9

  const circulationBN = totalSupply
    .sub(totalBalance)
    .sub(totalDeposited)
    .add(totalWithdrawn);

  const circulation = formatBNToDecimalString(circulationBN);

  return {
    totalBalance: formatBNToDecimalString(totalBalance),
    totalWithdrawn: formatBNToDecimalString(totalWithdrawn),
    totalDeposited: formatBNToDecimalString(totalDeposited),
    circulation, // number with 9 decimal precision
    totalSupply: formatBNToDecimalString(totalSupply),
  };
}
