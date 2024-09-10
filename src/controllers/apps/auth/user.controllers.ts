import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient, Users as User } from "@prisma/client";

import { asyncHandler } from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import ApiError from "@/utils/ApiError";
import {
  REFRESH_TOKEN_EXPIRY,
  USER_TEMPORARY_TOKEN_EXPIRY,
} from "@/utils/constants";

const prisma = new PrismaClient();

export const registerUser = asyncHandler(async (req, res) => {
  // Get the name, email and password from the request body
  const { name, email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    throw new ApiError(400, "email and password is required");
  }

  // Check if a user with the same email already exists
  const existedUser = await prisma.users.findFirst({ where: { email } });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // Create the new user in the database
  const createdUser = await prisma.users.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      name,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Generate a temporary token for email verification
  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  // Store the token in the database
  await prisma.tokens.create({
    data: {
      userId: createdUser.id,
      token: hashedToken,
      expiryAt: new Date(tokenExpiry),
      type: "VERIFY_EMAIL_TOKEN",
    },
  });

  // TODO: Send verification email to the user

  // Return a success response with the newly created user
  return res.status(201).json(
    new ApiResponse(
      200,
      "Users registered successfully and verification email has been sent on your email.",
      {
        user: createdUser,
      }
    )
  );
});

export const loginUser = asyncHandler(async (req, res) => {
  // Extract email and password from request body
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    throw new ApiError(400, "email and password is required");
  }

  // Find user by email
  const loggedInUser = await prisma.users.findFirst({ where: { email } });

  // Throw error if user not found
  if (!loggedInUser) {
    throw new ApiError(404, "User does not exist");
  }

  // Verify password
  const isCorrect = await isPasswordCorrect(password, loggedInUser);
  if (!isCorrect) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    loggedInUser
  );

  // TODO: Add more options to make cookie more secure and reliable
  // Cookie options
  const options = {
    httpOnly: true, // accessible only by the browser
    secure: process.env.NODE_ENV === "production", // only over HTTPS in production
  };

  loggedInUser.id = undefined;
  loggedInUser.password = undefined;

  // Set cookies and send response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        "User logged in successfully",
        { user: loggedInUser, accessToken, refreshToken } // send tokens in response for client-side storage
      )
    );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;
  if (!verificationToken) {
    throw new ApiError(400, "Verification token is required");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const token = await prisma.tokens.findFirst({
    where: {
      token: hashedToken,
      type: "VERIFY_EMAIL_TOKEN",
      expiryAt: { gt: new Date() },
    },
  });

  if (!token) {
    throw new ApiError(400, "Invalid or expired token");
  }

  await prisma.tokens.delete({ where: { id: token.id } });
  await prisma.users.update({
    where: { id: token.userId },
    data: { isEmailVerified: true },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Email verified successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;

  loggedInUser.id = undefined;
  loggedInUser.password = undefined;

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Current user fetched successfully", loggedInUser)
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  await prisma.tokens.deleteMany({ where: { userId: loggedInUser.id } });

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logged out"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    ) as { _id: number };
    const user = await prisma.users.findFirst({
      where: { id: decodedToken?._id },
    });
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // check if incoming refresh token is same as the refresh token attached in the user document
    // This shows that the refresh token is used or not
    // Once it is used, we are replacing it with new refresh token below
    const userToken = await prisma.tokens.findFirst({
      where: {
        userId: user.id,
        type: "REFRESH_TOKEN",
        expiryAt: { gt: new Date() },
      },
    });
    if (incomingRefreshToken !== userToken.token) {
      // If token is valid but is used already
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, "Access token refreshed", {
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const isPasswordCorrect = async (password: string, user: User) => {
  return await bcrypt.compare(password, user.password);
};

const generateAccessToken = (user: User) => {
  return jwt.sign(
    {
      _id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = function (user: User) {
  return jwt.sign({ _id: user.id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

const generateAccessAndRefreshTokens = async (user: User) => {
  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await prisma.tokens.create({
      data: {
        userId: user.id,
        token: refreshToken,
        type: "REFRESH_TOKEN",
        expiryAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
      },
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating the access token"
    );
  }
};

const generateTemporaryToken = () => {
  // This token should be client facing
  // for example: for email verification unHashedToken should go into the user's mail
  const unHashedToken = crypto.randomBytes(20).toString("hex");

  // This should stay in the DB to compare at the time of verification
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");
  // This is the expiry time for the token (20 minutes)
  const tokenExpiry = Date.now() + USER_TEMPORARY_TOKEN_EXPIRY;

  return { unHashedToken, hashedToken, tokenExpiry };
};
