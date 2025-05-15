import express from 'express';
import fetch from 'node-fetch';
import { StreamflowSui } from '@streamflow/stream';
import BN from 'bn.js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const app = express();
const PORT = process.env.PORT || 3000;

const DMC_DECIMALS = new BN(10).pow(new BN(9));
const treasuryAddress = process.env.TREASURY_ADDRESS || "0x8784e730078c87be9fbf9975392f4bc08e39a09a39207b50ba2fca58b5fcd2b1";
const coinType = "0x4c981f3ff786cdb9e514da897ab8a953647dae2ace9679e8358eec1e3e8871ac::dmc::DMC";

const streamflowClient = new StreamflowSui.SuiStreamClient("https://fullnode.mainnet.sui.io");
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

async function getCirculation(treasuryAddress, coinType) {
  const contractsResp = await fetch(
    `https://api.streamflow.finance/v1/api/chain/6/contracts?address=${treasuryAddress}`,
    { headers: { 'accept': 'application/json' } }
  );

  if (!contractsResp.ok) throw new Error(`Streamflow API error: ${contractsResp.status}`);

  const contracts = await contractsResp.json();
  const suiContracts = contracts.data.filter(contract => contract.token === coinType);

  let totalWithdrawn = new BN(0);
  let totalDeposited = new BN(0);

  for (const contract of suiContracts) {
    try {
      const stream = await streamflowClient.getOne({ id: contract.address });
      totalWithdrawn = totalWithdrawn.add(stream.withdrawnAmount);
      totalDeposited = totalDeposited.add(stream.depositedAmount);
    } catch (e) {
      console.error(`Error fetching stream ${contract.address}:`, e.message);
    }
  }

  const coinList = await client.getCoins({ owner: treasuryAddress, coinType });

  let totalBalance = new BN(0);
  coinList.data.forEach(coin => {
    totalBalance = totalBalance.add(new BN(coin.balance));
  });

  const totalSupply = new BN(12800000000).mul(DMC_DECIMALS);
  const circulation = totalSupply.sub(totalBalance).sub(totalDeposited).add(totalWithdrawn);

  return {
    circulating: circulation.div(DMC_DECIMALS).toString(),
    balance: totalBalance.div(DMC_DECIMALS).toString(),
    withdrawn: totalWithdrawn.div(DMC_DECIMALS).toString(),
    deposited: totalDeposited.div(DMC_DECIMALS).toString()
  };
}

async function getTotalSupplyFromSuiScan() {
  const objectId = "0x142f5f52a5bbe44524c79490937ca5396e7effcad42996bf2c293d233e4b1a08";
  const response = await fetch(`https://fullnode.mainnet.sui.io/v1/object/${objectId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch total supply from Sui: ${response.status}`);
  }

  const json = await response.json();
  const rawSupply = json.data?.content?.fields?.value;

  if (!rawSupply) {
    throw new Error("Total supply value not found in response");
  }

  return new BN(rawSupply).div(DMC_DECIMALS).toString();
}

app.get('/circulation', async (req, res) => {
  try {
    const data = await getCirculation(treasuryAddress, coinType);
    res.json({ timestamp: new Date().toISOString(), ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/total-supply', async (req, res) => {
  try {
    const totalSupplyObjectId = "0x142f5f52a5bbe44524c79490937ca5396e7effcad42996bf2c293d233e4b1a08";
    const obj = await client.getObject({ id: totalSupplyObjectId, options: { showContent: true } });

    const rawSupply = obj.data.content.fields.total_supply.fields.value;
    const totalSupply = new BN(rawSupply).div(DMC_DECIMALS).toString();

    res.json({ timestamp: new Date().toISOString(), totalSupply });
  } catch (e) {
    res.status(500).json({ error: "Total supply fetch failed", detail: e.message });
  }
});


app.listen(PORT, () => {
  console.log(`Circulation API running at http://localhost:${PORT}/circulation`);
  console.log(`Total Supply API running at http://localhost:${PORT}/total-supply`);
});
