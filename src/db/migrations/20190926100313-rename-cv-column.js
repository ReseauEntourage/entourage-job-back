export default {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.renameColumn('CVs', 'firstname', 'firstName', {
          transaction: t,
        }),
        queryInterface.renameColumn('CVs', 'lastname', 'lastName', {
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.renameColumn('CVs', 'firstName', 'firstname', {
          transaction: t,
        }),
        queryInterface.renameColumn('CVs', 'lastName', 'lastname', {
          transaction: t,
        }),
      ]);
    });
  },
};
