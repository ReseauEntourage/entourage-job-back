export const forbiddenExpressions = [
  'de bonne moralité',
  'de bonne moralite',
  'de bonne renommée',
  'de bonne renommee',
  'collecter les loyers',
  'vous serez à mon service',
  'comme un job enfin un complément de revenu',
];

export const forbiddenExpressionsInMessage = (message: string): string[] => {
  return forbiddenExpressions.filter((expression) =>
    message.toLowerCase().includes(expression)
  );
};
