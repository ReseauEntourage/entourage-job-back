'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const elearningUnitsIds = [uuid.v4(), uuid.v4(), uuid.v4(), uuid.v4()];
    await queryInterface.bulkInsert('ElearningUnits', [
      {
        id: elearningUnitsIds[0],
        title: 'Comprendre mon rôle de coach sur Entourage Job',
        description:
          'Cette vidéo explique le rôle des coachs sur la plateforme Entourage Job.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 10,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningUnitsIds[1],
        title: 'Comprendre mon rôle de candidat sur Entourage Job',
        description:
          'Cette vidéo explique le rôle des candidats sur la plateforme Entourage Job.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 10,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningUnitsIds[2],
        title: "Utiliser les outils d'Entourage Job",
        description:
          'Cette vidéo présente les différents outils disponibles sur la plateforme Entourage Job.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 15,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('ElearningUnitRoles', [
      // Unit 0 for Coach role
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[0],
        role: 'Coach',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Unit 1 for Candidat role
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[1],
        role: 'Candidat',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Unit 2 for both roles
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[2],
        role: 'Coach',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[2],
        role: 'Candidat',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const elearningQuestionsIds = [
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
    ];
    await queryInterface.bulkInsert('ElearningQuestions', [
      {
        id: elearningQuestionsIds[0],
        unitId: elearningUnitsIds[0],
        label: 'Quel est le rôle principal d’un coach sur Entourage Job ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[1],
        unitId: elearningUnitsIds[0],
        label: 'Comment un coach peut-il aider un candidat ?',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[2],
        unitId: elearningUnitsIds[1],
        label: 'Quel est le rôle principal d’un candidat sur Entourage Job ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[3],
        unitId: elearningUnitsIds[1],
        label:
          'Comment un candidat peut-il maximiser ses chances de trouver un emploi ?',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[4],
        unitId: elearningUnitsIds[2],
        label:
          'Quels outils sont disponibles sur Entourage Job pour les utilisateurs ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('ElearningAnswers', [
      // Answers for Unit 0 Questions
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[0],
        label: 'Accompagner les candidats dans leur recherche d’emploi',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[0],
        label: 'Publier des offres d’emploi',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[1],
        label: 'En les guidant et en leur fournissant des ressources',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[1],
        label: 'En leur trouvant directement un emploi',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Answers for Unit 1 Questions
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[2],
        label: 'Rechercher activement des opportunités d’emploi',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[2],
        label: 'Coacher d’autres candidats',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[3],
        label:
          'En utilisant les ressources et le soutien disponibles sur la plateforme',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[3],
        label: 'En attendant que les offres d’emploi arrivent',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Answers for Unit 2 Question
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[4],
        label: 'Tableau de bord, messagerie, et ressources de formation',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[4],
        label: 'Jeux en ligne',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    // No need to implement the down function for seeders
  },
};
