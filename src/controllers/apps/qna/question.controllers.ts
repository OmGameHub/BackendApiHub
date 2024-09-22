import { Prisma } from "@prisma/client";

import { asyncHandler } from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import ApiError from "@/utils/ApiError";

import { apiQueryBuilder, getPaginationMetaData } from "@/utils/helpers";
import dbClient from "@/prisma/dbClient";

export const getAllQuestions = asyncHandler(async (req, res) => {
  let { limit = 10, page = 1, q } = apiQueryBuilder(req.query);
  const skip = (page - 1) * limit;
  const loggedInUser = req.user;

  const query: Prisma.QuestionsScalarWhereInput = {};
  if (q) {
    query.OR = [
      {
        title: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: q,
          mode: "insensitive",
        },
      },
    ];
  }
  const metaData = await getPaginationMetaData(dbClient.questions, {
    query,
    page,
    limit,
  });

  const whereQuery = q
    ? `q."title" ILIKE '%${q}%' OR q."description" ILIKE '%${q}%'`
    : "1=1";
  const questions = await selectAllDBQuestions(
    whereQuery,
    loggedInUser?.id,
    limit,
    skip
  );

  return res.status(200).json(
    new ApiResponse(200, "Questions fetched successfully", {
      list: questions,
      meta: metaData,
    })
  );
});

export const getQuestionById = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const loggedInUser = req.user;

  const question = await dbClient.questions.findFirst({
    where: { uuid: questionId },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  const selectedQuestion = await selectAllDBQuestions(
    `q.id = ${question.id}`,
    loggedInUser?.id
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Question fetched successfully", selectedQuestion)
    );
});

export const getMyQuestions = asyncHandler(async (req, res) => {
  let { limit = 10, page = 1, q } = apiQueryBuilder(req.query);
  const skip = (page - 1) * limit;
  const loggedInUser = req.user;

  const query: Prisma.QuestionsScalarWhereInput = {
    createdByUserId: loggedInUser.id,
  };
  if (q) {
    query.OR = [
      {
        title: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: q,
          mode: "insensitive",
        },
      },
    ];
  }
  const metaData = await getPaginationMetaData(dbClient.questions, {
    query,
    page,
    limit,
  });

  const whereQuery = q
    ? `q."createdByUserId" = ${loggedInUser.id} AND (q."title" ILIKE '%${q}%' OR q."description" ILIKE '%${q}%')`
    : `q."createdByUserId" = ${loggedInUser.id}`;
  const questions = await selectAllDBQuestions(
    whereQuery,
    loggedInUser?.id,
    limit,
    skip
  );

  return res.status(200).json(
    new ApiResponse(200, "Questions fetched successfully", {
      list: questions,
      meta: metaData,
    })
  );
});

export const createQuestion = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { title, description } = req.body;

  const question = await dbClient.questions.create({
    data: {
      title,
      description,
      createdByUserId: loggedInUser.id,
    },
  });

  const createdQuestion = await selectAllDBQuestions(
    `q.id = ${question.id}`,
    loggedInUser?.id
  );
  return res
    .status(201)
    .json(
      new ApiResponse(201, "Question created successfully", createdQuestion)
    );
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const loggedInUser = req.user;
  const { title, description } = req.body;

  const question = await dbClient.questions.findFirst({
    where: {
      uuid: questionId,
    },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  if (question.createdByUserId !== loggedInUser.id) {
    throw new ApiError(403, "You are not authorized to update this question");
  }

  await dbClient.questions.update({
    where: { id: question.id },
    data: { title, description },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Question updated successfully"));
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const loggedInUser = req.user;

  const question = await dbClient.questions.findFirst({
    where: { uuid: questionId },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  if (question.createdByUserId !== loggedInUser.id) {
    throw new ApiError(403, "You are not authorized to delete this question");
  }

  await dbClient.questions.delete({ where: { id: question.id } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Question deleted successfully"));
});

export const toggleUpvoteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const loggedInUser = req.user;

  const question = await dbClient.questions.findFirst({
    where: {
      uuid: questionId,
    },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  const existingVote = await dbClient.questionVotes.findFirst({
    where: {
      questionId: question.id,
      userId: loggedInUser.id,
    },
  });

  if (existingVote) {
    await dbClient.questionVotes.delete({
      where: {
        questionId_userId: {
          questionId: question.id,
          userId: loggedInUser.id,
        },
      },
    });
  }

  const isUpvote = existingVote?.voteType === "UPVOTE";
  if (!isUpvote) {
    await dbClient.questionVotes.create({
      data: {
        voteType: "UPVOTE",
        questionId: question.id,
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

export const toggleDownvoteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const loggedInUser = req.user;

  const question = await dbClient.questions.findFirst({
    where: { uuid: questionId },
  });

  if (!question) {
    throw new ApiError(404, "Question does not exist");
  }

  const existingVote = await dbClient.questionVotes.findFirst({
    where: {
      questionId: question.id,
      userId: loggedInUser.id,
    },
  });

  if (existingVote) {
    await dbClient.questionVotes.delete({
      where: {
        questionId_userId: {
          questionId: question.id,
          userId: loggedInUser.id,
        },
      },
    });
  }

  const isDownvote = existingVote?.voteType === "DOWNVOTE";
  if (!isDownvote) {
    await dbClient.questionVotes.create({
      data: {
        voteType: "DOWNVOTE",
        questionId: question.id,
        userId: loggedInUser.id,
      },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        `Downvote ${isDownvote ? "remove" : "added"} successfully`
      )
    );
});

const selectAllDBQuestions = async (
  whereQuery: string,
  userId = 0,
  limit = 1,
  skip = 0
) => {
  const questions = await dbClient.$queryRaw<any[]>`
    SELECT
      q.uuid as _id,
      q.title,
      q.description,
      q."createdAt",
      q."deletedAt",
      json_build_object(
        '_id', u.uuid,
        'name', u.name,
        'email', u.email
      ) AS "createdByUser",
      bool_or(qv."voteType" = 'UPVOTE' AND qv."userId" = ${userId}) AS "isUpvote",
      bool_or(qv."voteType" = 'DOWNVOTE' AND qv."userId" = ${userId}) AS "isDownvote",
      COUNT(CASE WHEN qv."voteType" = 'UPVOTE' THEN 1 END)::integer AS "upvoteCount",
      COUNT(CASE WHEN qv."voteType" = 'DOWNVOTE' THEN 1 END)::integer AS "downvoteCount"
    FROM "Questions" q
    JOIN "Users" u ON u.id = q."createdByUserId"
    LEFT JOIN "QuestionVotes" qv ON qv."questionId" = q.id
    WHERE ${Prisma.sql([whereQuery])} AND q."deletedAt" IS NULL
    GROUP BY q.id, u.id
    ORDER BY "upvoteCount" DESC
    LIMIT ${limit}
    OFFSET ${skip}
  `;

  if (!questions.length) return null;
  if (limit === 1) return questions[0];
  return questions;
};
