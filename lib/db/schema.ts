import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  userUuid: uuid('user_uuid').references(() => profiles.id, { onDelete: 'cascade' }),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userUuid: uuid('user_uuid').references(() => profiles.id, { onDelete: 'set null' }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  profile: one(profiles, {
    fields: [teamMembers.userUuid],
    references: [profiles.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  profile: one(profiles, {
    fields: [activityLogs.userUuid],
    references: [profiles.id],
  }),
}));


export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
  // LiteLLM Customer fields
  alias: text('alias'),
  blocked: boolean('blocked').default(false),
  maxBudget: integer('max_budget'), // in cents
  budgetId: text('budget_id'),
  allowedModelRegion: varchar('allowed_model_region', { length: 10 }), // 'eu' or 'us'
  defaultModel: text('default_model'),
  budgetDuration: text('budget_duration'),
  tpmLimit: integer('tpm_limit'),
  rpmLimit: integer('rpm_limit'),
  modelMaxBudget: text('model_max_budget'), // JSON object
  maxParallelRequests: integer('max_parallel_requests'),
  softBudget: integer('soft_budget'), // in cents
  spend: integer('spend').default(0), // in cents
  budgetResetAt: timestamp('budget_reset_at'),
  litellmCustomerId: text('litellm_customer_id').unique(), // LiteLLM's internal customer ID
  metadata: text('metadata'), // JSON object for additional data
});

export const virtualKeys = pgTable('virtual_keys', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  key: text('key').notNull().unique(),
  creditBalance: integer('credit_balance').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  // LiteLLM integration fields
  litellmKeyId: text('litellm_key_id').unique(),
  rpmLimit: integer('rpm_limit'),
  tpmLimit: integer('tpm_limit'),
  maxBudget: integer('max_budget'), // in cents
  budgetDuration: text('budget_duration'), // e.g., "30d", "1h"
  modelRestrictions: text('model_restrictions'), // JSON array of allowed models
  guardrails: text('guardrails'), // JSON array of guardrail names
  metadata: text('metadata'), // JSON object for additional data
  lastSyncedAt: timestamp('last_synced_at'),
  syncStatus: varchar('sync_status', { length: 20 }).default('pending'), // pending, synced, failed
});

export const transactions = pgTable('transactions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  amount: integer('amount'),
  creditAdded: integer('credit_added'),
  paystackRef: text('paystack_ref'),
  status: text('status'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  virtualKeyId: uuid('virtual_key_id').references(() => virtualKeys.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').default(0),
  completionTokens: integer('completion_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  cacheReadInputTokens: integer('cache_read_input_tokens').default(0),
  cacheCreationInputTokens: integer('cache_creation_input_tokens').default(0),
  costInCents: integer('cost_in_cents').notNull(),
  litellmModelId: text('litellm_model_id'),
  provider: text('provider'),
  requestDuration: integer('request_duration_ms'),
  status: varchar('status', { length: 20 }).default('success'), // success, failed, error
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemAlerts = pgTable('system_alerts', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  service: varchar('service', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  message: text('message').notNull(),
  details: text('details'), // JSON data
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const monitoringLogs = pgTable('monitoring_logs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  service: varchar('service', { length: 50 }).notNull(),
  checkType: varchar('check_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  details: text('details'), // JSON data
  createdAt: timestamp('created_at').defaultNow(),
});

export const profilesRelations = relations(profiles, ({ many }) => ({
  virtualKeys: many(virtualKeys),
  transactions: many(transactions),
  usageLogs: many(usageLogs),
}));

export const virtualKeysRelations = relations(virtualKeys, ({ one, many }) => ({
  user: one(profiles, {
    fields: [virtualKeys.userId],
    references: [profiles.id],
  }),
  usageLogs: many(usageLogs),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(profiles, {
    fields: [usageLogs.userId],
    references: [profiles.id],
  }),
  virtualKey: one(virtualKeys, {
    fields: [usageLogs.virtualKeyId],
    references: [virtualKeys.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(profiles, {
    fields: [transactions.userId],
    references: [profiles.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// Export types for new tables
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type VirtualKey = typeof virtualKeys.$inferSelect;
export type NewVirtualKey = typeof virtualKeys.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
export type SystemAlert = typeof systemAlerts.$inferSelect;
export type NewSystemAlert = typeof systemAlerts.$inferInsert;
export type MonitoringLog = typeof monitoringLogs.$inferSelect;
export type NewMonitoringLog = typeof monitoringLogs.$inferInsert;
