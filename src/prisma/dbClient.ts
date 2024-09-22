import { Prisma, PrismaClient } from "@prisma/client";

const dbClient = new PrismaClient();

// create prisma client extension to remove soft deleted records
const nonSoftDeletedItemsFindActions: Prisma.MiddlewareParams["action"][] = [
  "findMany",
  "findFirst",
  "findUnique",
  "count",
];

const Models = Prisma.dmmf.datamodel.models;
const softDeleteEnabledModels: { [key: string]: boolean } = Models.reduce(
  (acc: { [key: string]: boolean }, model) => {
    if (model.fields.some((f) => f.name === "deletedAt")) {
      acc[model.name] = true;
    }
    return acc;
  },
  {}
);

dbClient.$use(async (params, next) => {
  const { model, action, args } = params;

  if (softDeleteEnabledModels[model]) {
    if (action === "delete") {
      params.action = "update";
      params.args = {
        ...args,
        data: { deletedAt: new Date() },
      };
    } else if (nonSoftDeletedItemsFindActions.includes(action)) {
      if (!args.where) {
        args.where = {};
      }

      args.where.deletedAt = null;
    }
  }

  return next(params);
});

export default dbClient;
