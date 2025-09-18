import { NextRequest, NextResponse } from 'next/server';
import { liteLLMClient } from '@/lib/litellm/client';
import { db } from '@/lib/db/drizzle';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endUserId = searchParams.get('end_user_id');

    if (!endUserId) {
      return NextResponse.json(
        { error: 'end_user_id parameter is required' },
        { status: 400 }
      );
    }

    // Get customer info from LiteLLM
    const customerInfo = await liteLLMClient.getCustomerInfo(endUserId);

    return NextResponse.json(customerInfo);
  } catch (error) {
    console.error('Error fetching customer info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer information' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      alias,
      blocked = false,
      max_budget,
      budget_id,
      allowed_model_region,
      default_model,
      metadata,
      budget_duration,
      tpm_limit,
      rpm_limit,
      model_max_budget,
      max_parallel_requests,
      soft_budget,
      spend = 0,
      budget_reset_at,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Create customer in LiteLLM
    const liteLLMCustomer = await liteLLMClient.createCustomer({
      user_id,
      alias,
      blocked,
      max_budget,
      budget_id,
      allowed_model_region,
      default_model,
      metadata,
      budget_duration,
      tpm_limit,
      rpm_limit,
      model_max_budget,
      max_parallel_requests,
      soft_budget,
      spend,
      budget_reset_at,
    });

    // Update our database with the customer information
    await db
      .update(profiles)
      .set({
        alias,
        blocked,
        maxBudget: max_budget ? Math.round(max_budget * 100) : undefined, // Convert to cents
        budgetId: budget_id,
        allowedModelRegion: allowed_model_region,
        defaultModel: default_model,
        budgetDuration: budget_duration,
        tpmLimit: tpm_limit,
        rpmLimit: rpm_limit,
        modelMaxBudget: model_max_budget ? JSON.stringify(model_max_budget) : undefined,
        maxParallelRequests: max_parallel_requests,
        softBudget: soft_budget ? Math.round(soft_budget * 100) : undefined, // Convert to cents
        spend: Math.round(spend * 100), // Convert to cents
        budgetResetAt: budget_reset_at ? new Date(budget_reset_at) : undefined,
        litellmCustomerId: user_id, // Store the LiteLLM customer ID
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })
      .where(eq(profiles.id, user_id));

    return NextResponse.json(liteLLMCustomer);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
