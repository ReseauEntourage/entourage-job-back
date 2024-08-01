export const forbiddenExpressions = [
  'compte bancaire',
  'coordonnées bancaires',
  'carte d’identité',
  'carte vitale',
  'numéro de sécurité social',
  'passeport',
  'titre de séjour',
  'chez moi',
  'sexe',
  'politique',
  'carte de résident',
  'visa',
  'attestation',
  'récépissé',
  'mot de passe',
  'porno',
  'complément de revenu',
  'banque',
  'de bonne renommée',
  'collecter les loyers',
  'vous serez à mon service',
];

export const forbiddenExpressionsInMessage = (message: string): string[] => {
  return forbiddenExpressions.filter((expression) =>
    message.toLowerCase().includes(expression)
  );
};
