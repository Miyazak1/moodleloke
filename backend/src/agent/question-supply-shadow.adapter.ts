import { Injectable } from '@nestjs/common';
import {
  QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION,
  QuestionSupplyDemandV1,
  QuestionSupplyDispatchResult,
  QuestionSupplyProductionAdapter
} from './question-supply-fulfillment.contract';

@Injectable()
export class QuestionSupplyShadowAdapter implements QuestionSupplyProductionAdapter {
  async dispatch(_demand: QuestionSupplyDemandV1): Promise<QuestionSupplyDispatchResult> {
    return {
      status: 'shadow_recorded',
      adapterVersion: QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION,
      externalRequestId: null,
      generationInvoked: false
    };
  }
}
