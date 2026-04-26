
export const getCategoryName = (category: string): string => {
  const categoryNames: Record<string, string> = {
    'cow-care': 'Cow Care',
    'nutrition': 'Nutrition',
    'success-stories': 'Success Stories',
    'events': 'Events',
  };
  return categoryNames[category] || category;
};
