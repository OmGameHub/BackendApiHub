import { Prisma } from "@prisma/client";
import { asyncHandler } from "@/utils/asyncHandler";
import dbClient from "@/prisma/dbClient";
import ApiResponse from "@/utils/ApiResponse";
import ApiError from "@/utils/ApiError";
import { apiQueryBuilder, getPaginationMetaData } from "@/utils/helpers";
import { userTransform } from "@/controllers/apps/auth/user.controllers";
import { UserRolesEnum } from "@/utils/constants";

export const getAllAvailableUsers = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = apiQueryBuilder(req.query);
  const loggedInUser = req.user;

  const query: Prisma.UsersWhereInput = {
    NOT: {
      id: loggedInUser.id,
    },
  };

  if (q) {
    query.OR = [
      {
        name: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: q,
          mode: "insensitive",
        },
      },
    ];
  }
  const metaData = await getPaginationMetaData(dbClient.users, {
    query,
    page,
    limit,
  });

  const users = await dbClient.users.findMany({
    where: query,
    skip: (page - 1) * limit,
    take: limit,
  });

  return res.status(200).json(
    new ApiResponse(200, "Successfully fetched users", {
      list: users.map(userTransform),
      meta: metaData,
    })
  );
});

export const createOrGetAOneOnOneChat = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { receiverId } = req.params;

  const receiver = await dbClient.users.findUnique({
    where: { uuid: receiverId },
  });

  if (!receiver) {
    throw new ApiError(404, "Receiver does not exist");
  }

  const whereQuery = `
    chat."isGroupChat" = false AND 
    chat.id IN (
      SELECT member."chatChannelId"
        FROM "ChatChannelMembers" member
        WHERE member."userId" = ${receiver.id}
      ) AND chat.id IN (
        SELECT member."chatChannelId"
        FROM "ChatChannelMembers" member
        WHERE member."userId" = ${loggedInUser.id}
      )
  `;

  const chat = await selectAllDBQChatChannels(whereQuery, loggedInUser.id);
  if (chat) {
    return res
      .status(200)
      .json(new ApiResponse(200, "Chat retrieved successfully", chat));
  }

  const newChat = await dbClient.chatChannels.create({
    data: {
      isGroupChat: false,
      createdByUserId: loggedInUser.id,
      members: {
        create: [
          {
            userId: loggedInUser.id,
          },
          {
            userId: receiver.id,
          },
        ],
      },
    },
  });

  const selectedChat = await selectAllDBQChatChannels(
    `chat.id = '${newChat.id}'`,
    loggedInUser.id
  );
  return res
    .status(201)
    .json(new ApiResponse(201, "Chat retrieved successfully", selectedChat));
});

const selectAllDBQChatChannels = async (
  whereQuery: string,
  userId = 0,
  limit = 1,
  skip = 0
) => {
  const chatChannels = await dbClient.$queryRaw<any[]>`
    SELECT
      chat.uuid AS _id,
      chat.name,
      chat."createdAt",
      chat."isGroupChat",
      (
        SELECT
          json_agg(
            json_build_object(
              '_id', memberUser.uuid,
              'name', memberUser.name,
              'email', memberUser.email,
              'role', member.role,
              'joinedAt', member."createdAt"
            )
          )
        FROM "ChatChannelMembers" member
        JOIN "Users" memberUser ON memberUser.id = member."userId"
        WHERE member."chatChannelId" = chat.id
      ) AS members,
      (
        SELECT 
          json_build_object(
            '_id', msg.uuid,
            'content', msg.content,
            'createdByUser', json_build_object(
              '_id', msgUser.uuid,
              'name', msgUser.name,
              'email', msgUser.email
            ),
            'createdAt', msg."createdAt"
          )
        FROM "ChatMessages" msg
        JOIN "Users" msgUser ON msgUser.id = msg."createdByUserId"
        WHERE msg."chatChannelId" = chat.id
        ORDER BY msg."createdAt" DESC
        LIMIT 1
      ) AS lastMessage,
      json_build_object(
        '_id', u.uuid,
        'name', u.name,
        'email', u.email
      ) AS createdByUser
    FROM "ChatChannels" chat
    JOIN "Users" u ON u.id = chat."createdByUserId"
    WHERE  
      chat."deletedAt" IS NULL AND 
      chat.id IN (
        SELECT member."chatChannelId"
        FROM "ChatChannelMembers" member
        WHERE member."userId" = ${userId}
      ) AND
      ${Prisma.sql([whereQuery])}
    ORDER BY COALESCE(
      (
        SELECT msg."createdAt"
        FROM "ChatMessages" msg
        WHERE msg."chatChannelId" = chat.id
        ORDER BY msg."createdAt" DESC
        LIMIT 1
      ),
      chat."createdAt"
    ) DESC
    LIMIT ${limit}
    OFFSET ${skip}
  `;

  if (limit === 1) return chatChannels[0];
  return chatChannels;
};
