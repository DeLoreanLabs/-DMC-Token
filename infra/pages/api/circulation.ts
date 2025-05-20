import { getCirculation } from "@/services/streamflow";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { circulation } = await getCirculation(
    process.env.TREASURY_ADDRESS as string,
    "0x4c981f3ff786cdb9e514da897ab8a953647dae2ace9679e8358eec1e3e8871ac::dmc::DMC"
  );

  res.status(200).json({ circulation });
}
