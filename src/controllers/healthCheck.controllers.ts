import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const healthCheck = asyncHandler(async (_, res) => {
  return res.status(200).json(new ApiResponse(200, "Health check passed"));
});
