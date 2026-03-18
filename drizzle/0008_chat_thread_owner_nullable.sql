-- Custom SQL migration file, put your code below! --
ALTER TABLE "chat_threads" ALTER COLUMN "owner_user_id" DROP NOT NULL;
