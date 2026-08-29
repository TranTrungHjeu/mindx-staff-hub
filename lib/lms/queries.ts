export const GET_TEACHERS = `
  query GetTeachers(
    $search: String,
    $isActive: Boolean,
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String,
    $centers: [String]
  ) {
    teachers(payload: {
      searchString_wordSearch: $search,
      isActive_eq: $isActive,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy,
      centres_in: $centers
    }) {
      data {
        id
        username
        fullName
        code
        phoneNumber
        email
        centres {
          id
          name
        }
      }
      pagination {
        total
      }
    }
  }
`;
