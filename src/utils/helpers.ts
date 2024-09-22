import ApiQueryType from "apiQuery.type";

export const apiQueryBuilder = (query: { [key: string]: any }) => {
  const queryBuilder: ApiQueryType = {};

  for (const key in query) {
    if (key === "page" || key === "limit") {
      queryBuilder[key] = Math.ceil(query[key]);
      queryBuilder[key] = queryBuilder[key] <= 1 ? 1 : queryBuilder[key];
    } else if (query[key]) {
      queryBuilder[key] = query[key];
    }
  }

  return queryBuilder;
};

export const getPaginationMetaData = async (
  prismaModal: { count: (params: any) => Promise<number> },
  { query = {}, page = 1, limit = 10 }
) => {
  const totalItem = await prismaModal.count({ where: query });
  const hasPrevPage = page > 1;
  const prevPage = hasPrevPage ? page - 1 : null;

  const hasNextPage = totalItem > page * limit;
  const nextPage = hasNextPage ? page + 1 : null;

  return {
    page,
    limit,
    total: totalItem,
    hasPrevPage,
    prevPage,
    hasNextPage,
    nextPage,
  };
};
