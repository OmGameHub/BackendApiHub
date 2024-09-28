import { asyncHandler } from "@/utils/asyncHandler";
import dbClient from "@/prisma/dbClient";
import ApiResponse from "@/utils/ApiResponse";
import ApiError from "@/utils/ApiError";
import { apiQueryBuilder, getPaginationMetaData } from "@/utils/helpers";
import { createdByUserSelect, UserRolesEnum } from "@/utils/constants";

const getOneChatChannelsById = async (chatId: string, userId: number) => {
  const selectedChat = await dbClient.chatChannels.findUnique({
    where: {
      uuid: chatId,
      members: {
        some: {
          userId,
        },
      },
    },
  });

  return selectedChat;
};

export const getAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 10 } = apiQueryBuilder(req.query);
  const loggedInUser = req.user;

  const selectedChat = await getOneChatChannelsById(chatId, loggedInUser.id);
  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const metaData = await getPaginationMetaData(dbClient.chatMessages, {
    query: { chatChannelId: selectedChat.id },
    page,
    limit,
  });

  const messages = await dbClient.chatMessages.findMany({
    where: {
      chatChannelId: selectedChat.id,
    },
    include: {
      createdByUser: createdByUserSelect,
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json(
    new ApiResponse(200, "Successfully fetched messages", {
      list: messages.map(messageTransform),
      meta: metaData,
    })
  );
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;
  const loggedInUser = req.user;

  const selectedChat = await getOneChatChannelsById(chatId, loggedInUser.id);
  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const newMessage = await dbClient.chatMessages.create({
    data: {
      content,
      chatChannelId: selectedChat.id,
      createdByUserId: loggedInUser.id,
    },
    include: {
      createdByUser: createdByUserSelect,
    },
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "Message sent successfully",
        messageTransform(newMessage)
      )
    );
});

export const updateOneMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body;
  const loggedInUser = req.user;

  const selectedChat = await getOneChatChannelsById(chatId, loggedInUser.id);
  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const selectedMessage = await dbClient.chatMessages.findFirst({
    where: {
      uuid: messageId,
      chatChannelId: selectedChat.id,
    },
  });

  if (!selectedMessage) {
    throw new ApiError(404, "Message does not exist");
  }

  if (selectedMessage.createdByUserId !== loggedInUser.id) {
    throw new ApiError(403, "You are not allowed to update this message");
  }

  const updatedMessage = await dbClient.chatMessages.update({
    where: {
      id: selectedMessage.id,
    },
    data: {
      content,
    },
    include: {
      createdByUser: createdByUserSelect,
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Message updated successfully",
        messageTransform(updatedMessage)
      )
    );
});
export const deleteOneMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const loggedInUser = req.user;

  const selectedChat = await getOneChatChannelsById(chatId, loggedInUser.id);
  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const selectedMessage = await dbClient.chatMessages.findFirst({
    where: {
      uuid: messageId,
      chatChannelId: selectedChat.id,
    },
  });
  if (!selectedMessage) {
    throw new ApiError(404, "Message does not exist");
  }

  if (
    selectedMessage.createdByUserId !== loggedInUser.id &&
    loggedInUser.role !== UserRolesEnum.ADMIN
  ) {
    throw new ApiError(403, "You are not allowed to delete this message");
  }

  await dbClient.chatMessages.delete({ where: { id: selectedMessage.id } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Message deleted successfully"));
});

export const messageTransform = (message: any) => {
  return {
    _id: message.uuid,
    content: message.content,
    createdByUser: {
      _id: message.createdByUser.uuid,
      name: message.createdByUser.name,
      email: message.createdByUser.email,
    },
    createdAt: message.createdAt,
  };
};
