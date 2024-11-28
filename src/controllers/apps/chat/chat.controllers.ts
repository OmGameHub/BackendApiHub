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

export const createGroupChat = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { name, memberIds = [] } = req.body;

  if (!name) {
    throw new ApiError(400, "Group name is required");
  }

  const members = await dbClient.users.findMany({
    where: {
      uuid: {
        in: memberIds,
      },
    },
  });

  const groupMemberIds = members.map((member) => member.id);
  if (!groupMemberIds.includes(loggedInUser.id)) {
    groupMemberIds.push(loggedInUser.id);
  }

  if (groupMemberIds.length < 2) {
    throw new ApiError(400, "Members are required to create a group chat");
  }

  const chatGroup = await dbClient.chatChannels.create({
    data: {
      isGroupChat: true,
      createdByUserId: loggedInUser.id,
      name,
      members: {
        create: groupMemberIds.map((memberId) => ({
          user: {
            connect: {
              id: memberId,
            },
          },
          role:
            memberId === loggedInUser.id
              ? UserRolesEnum.ADMIN
              : UserRolesEnum.USER,
        })) as Prisma.ChatChannelMembersCreateWithoutChatChannelInput[],
      },
    },
  });

  const whereQuery = `chat.id = '${chatGroup.id}'`;
  const selectedChat = await selectAllDBQChatChannels(
    whereQuery,
    loggedInUser.id
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "Chat retrieved successfully", selectedChat));
});

export const getAllChatChannels = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let { page = 1, limit = 10, isGroupChat } = apiQueryBuilder(req.query);
  const skip = (page - 1) * limit;

  if (isGroupChat) {
    isGroupChat = isGroupChat === "true";
  }

  const query: Prisma.ChatChannelsWhereInput = {
    members: {
      some: {
        userId: loggedInUser.id,
      },
    },
  };

  if (isGroupChat === "true") {
    query.isGroupChat = true;
  }

  const metaData = await getPaginationMetaData(dbClient.chatChannels, {
    query,
    page,
    limit,
  });

  const whereQuery =
    typeof isGroupChat === "boolean"
      ? `chat."isGroupChat" = ${isGroupChat}`
      : `1 = 1`;
  const chatChannels = await selectAllDBQChatChannels(
    whereQuery,
    loggedInUser.id,
    limit,
    skip
  );

  return res.status(200).json(
    new ApiResponse(200, "Chat channels fetched successfully", {
      list: chatChannels,
      meta: metaData,
    })
  );
});

export const getOneGroupChat = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { chatId } = req.params;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
  });
  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const selectedChat = await selectAllDBQChatChannels(
    `chat.id = '${chatGroup.id}'`,
    loggedInUser.id
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Chat group retrieved successfully", selectedChat)
    );
});

export const updateGroupChatDetails = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { chatId } = req.params;
  const { name } = req.body;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
    include: {
      members: true,
    },
  });

  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const member = chatGroup.members.find((m) => m.userId == loggedInUser.id);
  if (!member || member.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(403, "You are not authorized to update this chat group");
  }

  const updatedChatGroup = await dbClient.chatChannels.update({
    where: { id: chatGroup.id },
    data: {
      name,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Chat group updated successfully"));
});

export const changeMemberRoleInGroupChat = asyncHandler(async (req, res) => {
  const { chatId, memberId } = req.params;
  const loggedInUser = req.user;
  const { role = "" } = req.body;

  if (!role || !(role in UserRolesEnum)) {
    throw new ApiError(400, "Invalid role");
  }

  const member = await dbClient.users.findUnique({
    where: { uuid: memberId },
  });
  if (!member) {
    throw new ApiError(404, "User does not exist");
  }

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
    include: {
      members: true,
    },
  });

  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const mMember = chatGroup.members.find((m) => m.userId == loggedInUser.id);
  if (!mMember || mMember.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      403,
      "You are not authorized to change member role in this chat group"
    );
  }

  const isMemberInGroup = chatGroup.members.some((m) => m.userId == member.id);
  if (!isMemberInGroup) {
    throw new ApiError(400, "Member does not exist in this chat group");
  }

  await dbClient.chatChannelMembers.update({
    where: {
      userId_chatChannelId: {
        userId: member.id,
        chatChannelId: chatGroup.id,
      },
    },
    data: {
      role,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Member role changed successfully"));
});

export const addMembersInGroupChat = asyncHandler(async (req, res) => {
  const { chatId, memberId } = req.params;
  const loggedInUser = req.user;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
    include: {
      members: true,
    },
  });

  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const mMember = chatGroup.members.find((m) => m.userId == loggedInUser.id);
  if (!mMember || mMember.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      403,
      "You are not authorized to add members to this chat group"
    );
  }

  const participant = await dbClient.users.findUnique({
    where: { uuid: memberId },
  });

  if (!participant) {
    throw new ApiError(404, "Member does not exist");
  }

  const member = chatGroup.members.find((m) => m.userId == participant.id);
  if (member) {
    throw new ApiError(400, "Member already exists in this chat group");
  }

  await dbClient.chatChannelMembers.create({
    data: {
      chatChannelId: chatGroup.id,
      userId: participant.id,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Member added successfully"));
});

export const removeMemberFromChatGroup = asyncHandler(async (req, res) => {
  const { chatId, memberId } = req.params;
  const loggedInUser = req.user;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
    include: {
      members: true,
    },
  });

  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const mMember = chatGroup.members.find((m) => m.userId == loggedInUser.id);
  if (!mMember || mMember.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      403,
      "You are not authorized to remove members from this chat group"
    );
  }

  const participant = await dbClient.users.findUnique({
    where: { uuid: memberId },
  });

  if (!participant) {
    throw new ApiError(404, "Member does not exist");
  }

  const member = chatGroup.members.find((m) => m.userId == participant.id);
  if (!member) {
    throw new ApiError(400, "Member does not exist in this chat group");
  }

  await dbClient.chatChannelMembers.delete({
    where: {
      userId_chatChannelId: {
        userId: participant.id,
        chatChannelId: chatGroup.id,
      },
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Member removed successfully"));
});

export const leaveGroupChat = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { chatId } = req.params;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
  });
  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  await dbClient.chatChannelMembers.delete({
    where: {
      userId_chatChannelId: {
        userId: loggedInUser.id,
        chatChannelId: chatGroup.id,
      },
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "You have left the chat group"));
});

export const deleteGroupChat = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { chatId } = req.params;

  const chatGroup = await dbClient.chatChannels.findFirst({
    where: {
      uuid: chatId,
      isGroupChat: true,
      members: {
        some: {
          userId: loggedInUser.id,
        },
      },
    },
    include: {
      members: true,
    },
  });
  if (!chatGroup) {
    throw new ApiError(404, "Chat group does not exist");
  }

  const member = chatGroup.members.find((m) => m.userId == loggedInUser.id);
  if (!member || member.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(403, "You are not authorized to delete this chat group");
  }

  await dbClient.chatChannels.delete({
    where: { id: chatGroup.id },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Chat group deleted successfully"));
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
