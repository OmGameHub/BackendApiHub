import { Router } from "express";
import { healthCheck } from "@/controllers/healthCheck.controllers";

const router = Router();

router.route("/").get(healthCheck);

export default router;
