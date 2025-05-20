import { getCirculation } from "@/services/streamflow";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { totalDeposited } = await getCirculation(
    "0x8784e730078c87be9fbf9975392f4bc08e39a09a39207b50ba2fca58b5fcd2b1",
    "0x4c981f3ff786cdb9e514da897ab8a953647dae2ace9679e8358eec1e3e8871ac::dmc::DMC"
  );

  res.status(200).json({ totalDeposited });
}
