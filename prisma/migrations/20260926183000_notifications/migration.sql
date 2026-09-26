CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT,
    "matchId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "matchReminders" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_leagueId_createdAt_idx" ON "Notification"("leagueId", "createdAt");
CREATE INDEX "Notification_matchId_idx" ON "Notification"("matchId");

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
