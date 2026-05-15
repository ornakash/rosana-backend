import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { YaadPaymentIntentInput, YaadPaymentIntentResult } from './graphql/generated-shop-types';
import { YaadService } from './yaad.service';

@Resolver()
export class YaadShopResolver {
    constructor(private yaadService: YaadService) {}

    @Mutation()
    @Allow(Permission.Public)
    async createYaadPaymentIntent(
        @Ctx() ctx: RequestContext,
        @Args('input') input: YaadPaymentIntentInput,
    ): Promise<YaadPaymentIntentResult> {
        return this.yaadService.createPaymentIntent(ctx, input);
    }
}
