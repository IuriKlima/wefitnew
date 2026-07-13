import { Controller, Get, Inject } from "@nestjs/common";

import { Public } from "../../common/auth/public.decorator.js";
import { HealthService } from "./health.service.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getLive();
  }

  @Get("live")
  getLive() {
    return this.healthService.getLive();
  }

  @Get("ready")
  getReady() {
    return this.healthService.getReady();
  }
}
