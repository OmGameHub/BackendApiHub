import { Prisma } from "@prisma/client";

import { asyncHandler } from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import ApiError from "@/utils/ApiError";

import { apiQueryBuilder, getPaginationMetaData } from "@/utils/helpers";
import dbClient from "@/prisma/dbClient";

export const getAllAnswers = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { questionId } = req.params;
  const { page = 1, limit = 100 } = apiQueryBuilder(req.query);
  const skip = (page - 1) * limit;

  const question = await dbClient.questions.findFirst({
    where: { uuid: questionId },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  const query: Prisma.AnswersScalarWhereInput = { questionId: question.id };
  const metaData = await getPaginationMetaData(dbClient.answers, {
    query,
    page,
    limit,
  });

  const whereQuery = `ans."questionId" = ${question.id}`;
  const answers = await selectAllAnswers(
    whereQuery,
    loggedInUser?.id,
    limit,
    skip
  );

  return res.status(200).json(
    new ApiResponse(200, "Answers fetched successfully", {
      list: answers,
      meta: metaData,
    })
  );
});

export const getAnswerById = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const loggedInUser = req.user;

  const answer = await dbClient.answers.findFirst({
    where: { uuid: answerId },
  });

  if (!answer) {
    throw new ApiError(404, "Answer does not exist");
  }

  const selectedQuestion = await selectAllAnswers(
    `ans."id" = ${answer.id}`,
    loggedInUser?.id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Answer fetched successfully", selectedQuestion)
    );
});

export const addAnswer = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { questionId } = req.params;
  const { content } = req.body;

  const question = await dbClient.questions.findFirst({
    where: { uuid: questionId },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  const answer = await dbClient.answers.create({
    data: {
      content,
      questionId: question.id,
      createdByUserId: loggedInUser.id,
    },
  });

  const newAnswer = await selectAllAnswers(`ans."id" = ${answer.id}`);
  return res
    .status(201)
    .json(new ApiResponse(201, "Answer created successfully", newAnswer));
});

export const updateAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const loggedInUser = req.user;
  const { content } = req.body;

  const existingAnswer = await dbClient.answers.findFirst({
    where: { uuid: answerId },
  });
  if (!existingAnswer) {
    throw new ApiError(404, "Answer does not exist");
  }

  if (existingAnswer.createdByUserId !== loggedInUser.id) {
    throw new ApiError(403, "You are not authorized to update this answer");
  }

  await dbClient.answers.update({
    where: { id: existingAnswer.id },
    data: { content },
  });

  const updateAnswer = await selectAllAnswers(
    `ans."id" = ${existingAnswer.id}`
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Answer updated successfully", updateAnswer));
});

export const deleteAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const loggedInUser = req.user;

  const answer = await dbClient.answers.findFirst({
    where: { uuid: answerId },
  });

  if (!answer) {
    throw new ApiError(404, "Answer does not exist");
  }

  if (answer.createdByUserId !== loggedInUser.id) {
    throw new ApiError(403, "You are not authorized to delete this answer");
  }

  await dbClient.answers.delete({ where: { id: answer.id } });

  const deletedAnswer = {
    _id: answer.uuid,
    content: answer.content,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, "Answer deleted successfully", deletedAnswer));
});

export const toggleUpvoteAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const loggedInUser = req.user;

  const answer = await dbClient.answers.findFirst({
    where: { uuid: answerId },
  });

  if (!answer) {
    throw new ApiError(404, "Answer does not exist");
  }

  const existingVote = await dbClient.answerVotes.findFirst({
    where: {
      answerId: answer.id,
      userId: loggedInUser.id,
    },
  });

  if (existingVote) {
    await dbClient.answerVotes.delete({
      where: {
        answerId_userId: {
          answerId: answer.id,
          userId: loggedInUser.id,
        },
      },
    });
  }

  const isUpvote = existingVote?.voteType === "UPVOTE";
  if (!isUpvote) {
    await dbClient.answerVotes.create({
      data: {
        voteType: "UPVOTE",
        answerId: answer.id,
        userId: loggedInUser.id,
      },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        `Upvote ${isUpvote ? "removed " : "added"} successfully`
      )
    );
});

export const toggleDownvoteAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const loggedInUser = req.user;

  const answer = await dbClient.answers.findFirst({
    where: { uuid: answerId },
  });

  if (!answer) {
    throw new ApiError(404, "Answer does not exist");
  }

  const existingVote = await dbClient.answerVotes.findFirst({
    where: {
      answerId: answer.id,
      userId: loggedInUser.id,
    },
  });

  if (existingVote) {
    await dbClient.answerVotes.delete({
      where: {
        answerId_userId: {
          answerId: answer.id,
          userId: loggedInUser.id,
        },
      },
    });
  }

  const isDownvote = existingVote?.voteType === "DOWNVOTE";
  if (!isDownvote) {
    await dbClient.answerVotes.create({
      data: {
        voteType: "DOWNVOTE",
        answerId: answer.id,
        userId: loggedInUser.id,
      },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        `Downvote ${isDownvote ? "removed " : "added"} successfully`
      )
    );
});

const selectAllAnswers = async (
  whereQuery = "1=1",
  userId = 0,
  limit = 1,
  skip = 0
) => {
  const answers = await dbClient.$queryRaw<any[]>`
    SELECT
      ans.uuid as _id,
      ans.content,
      ans."createdAt",
      json_build_object(
        '_id', u.uuid,
        'name', u.name,
        'email', u.email
      ) AS "createdByUser",
      bool_or(av."voteType" = 'UPVOTE' AND av."userId" = ${userId}) AS "isUpvote",
      bool_or(av."voteType" = 'DOWNVOTE' AND av."userId" = ${userId}) AS "isDownvote",
      SUM(CASE WHEN av."voteType" = 'UPVOTE' THEN 1 ELSE 0 END)::integer AS "upvoteCount",
      SUM(CASE WHEN av."voteType" = 'DOWNVOTE' THEN 1 ELSE 0 END)::integer AS "downvoteCount"
    FROM "Answers" ans
    JOIN "Users" u ON u.id = ans."createdByUserId"
    LEFT JOIN "AnswerVotes" av ON av."answerId" = ans.id
    WHERE ${Prisma.sql([whereQuery])} AND ans."deletedAt" IS NULL
    GROUP BY ans.id, u.id
    ORDER BY "upvoteCount" DESC
    LIMIT ${limit}
    OFFSET ${skip}
  `;

  if (limit === 1) return answers[0];
  return answers;
};
