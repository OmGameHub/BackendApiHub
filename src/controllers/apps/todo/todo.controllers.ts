import { PrismaClient, Todos, Prisma } from "@prisma/client";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

const prisma = new PrismaClient();

/**
 * @desc     Get all todos for the logged-in user.
 * @route    GET /api/v1/todos
 * @access   Private
 * @param    {Object} req - Express request object.
 * @param    {Object} req.query - Query parameters for filtering todos.
 * @param    {string} [req.query.q] - Search query string to filter by title or description.
 * @param    {string} [req.query.status] - Filter by status (e.g., "pending", "inprogress", "completed").
 * @param    {boolean} [req.query.completed] - Filter by completion status (true/false).
 * @param    {Object} res - Express response object.
 * @returns  {Object} JSON response containing the list of todos.
 */
export const getAllTodos = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;

  // Extract query parameters with type assertions
  const { q, completed, status } = req.query as {
    q?: string;
    completed?: boolean;
    status?: string;
  };

  // Initialize Prisma query object
  const query: Prisma.TodosWhereInput = {};

  // Add filters to the query based on provided parameters
  if (typeof completed === "boolean") {
    query.completed = completed;
  }

  if (q) {
    query.OR = [
      {
        title: { contains: q, mode: "insensitive" },
      },
      {
        description: { contains: q, mode: "insensitive" },
      },
    ];
  }

  if (status) {
    query.status = status;
  }

  // Fetch todos from the database using Prisma client
  const todos = await prisma.todos.findMany({
    where: {
      ...query,
      createdByUserId: loggedInUser.id, // Filter by logged-in user's ID
    },
  });

  // Return a success response with the fetched todos
  return res
    .status(200)
    .json(new ApiResponse(200, "Todos fetched successfully", todos));
});

export const getTodoById = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { todoId } = req.params;

  const todo = await prisma.todos.findFirst({
    where: {
      id: parseInt(todoId),
      createdByUserId: loggedInUser.id,
    },
  });

  if (!todo) {
    return res.status(404).json(new ApiResponse(404, "Todo does not exist"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Todo fetched successfully", todo));
});

export const createTodo = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { title, description, status } = req.body as Todos;

  const todo = await prisma.todos.create({
    data: {
      title,
      description,
      status,
      createdByUserId: loggedInUser.id,
    },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Todo created successfully", todo));
});

export const updateTodo = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { todoId } = req.params;
  const { title, description, status, completed } = req.body as Todos;

  const todo = await prisma.todos.findFirst({
    where: {
      id: parseInt(todoId),
      createdByUserId: loggedInUser.id,
    },
  });

  if (!todo) {
    return res.status(404).json(new ApiResponse(404, "Todo does not exist"));
  }

  const updatedTodo = await prisma.todos.update({
    where: {
      id: todo.id,
    },
    data: {
      title,
      description,
      status,
      completed,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Todo updated successfully", updatedTodo));
});

export const deleteTodo = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { todoId } = req.params;

  const todo = await prisma.todos.findFirst({
    where: {
      id: parseInt(todoId),
      createdByUserId: loggedInUser.id,
    },
  });

  if (!todo) {
    return res.status(404).json(new ApiResponse(404, "Todo does not exist"));
  }

  const deletedTodo = await prisma.todos.delete({ where: { id: todo.id } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Todo deleted successfully", { deletedTodo }));
});
