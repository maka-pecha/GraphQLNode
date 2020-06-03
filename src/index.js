const express = require('express');
const app = express();
const { GraphQLError } = require('graphql'); // CommonJS
const expressGraphQL = require('express-graphql');
const _ = require('lodash');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
} = require('graphql');

const students = require('../data/Students');
const courses = require('../data/Courses');
const grades = require('../data/Grades');

/**----------------SCHEMAS----------------**/

const CourseType = new GraphQLObjectType({
  name: 'Course',
  description: 'Represent courses',
  fields: () => ({
    id: { type: GraphQLNonNull(GraphQLInt) },
    name: { type: GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLNonNull(GraphQLString) },
  })
});

const StudentType = new GraphQLObjectType({
  name: 'Student',
  description: 'Represent students',
  fields: () => ({
    id: { type: GraphQLNonNull(GraphQLInt) },
    firstName: { type: GraphQLNonNull(GraphQLString) },
    lastName: { type: GraphQLNonNull(GraphQLString) },
    courseId: { type: GraphQLNonNull(GraphQLInt) },
    course: {
      type: CourseType,
      resolve: (student) => {
        return courses.find(course => course.id === student.courseId)
      }
    }
  })
});

const GradeType = new GraphQLObjectType({
  name: 'Grade',
  description: 'Represent grade',
  fields: () => ({
    id: { type: GraphQLNonNull(GraphQLInt) },
    courseId: { type: GraphQLNonNull(GraphQLInt) },
    course: {
      type: CourseType,
      resolve: (grade) => {
        return courses.find(course => course.id === grade.courseId)
      }
    },
    studentId: { type: GraphQLNonNull(GraphQLInt) },
    student: {
      type: StudentType,
      resolve: (grade) => {
        return students.find(student => student.id === grade.studentId)
      }
    },
    grade: { type: GraphQLNonNull(GraphQLInt) }
  })
});

/**----------------ROOTS QUERYS----------------**/

const RootQueryType = new GraphQLObjectType({
  name: 'Query',
  description: 'Root Query',
  fields: () => ({
    courses: {
      type: new GraphQLList(CourseType),
      description: 'List of All Courses',
      resolve: () => courses
    },
    students: {
      type: new GraphQLList(StudentType),
      description: 'List of All Students',
      resolve: () => students
    },
    grades: {
      type: new GraphQLList(GradeType),
      description: 'List of All Grades',
      resolve: () => grades
    },
    course: { // para buscar un course por id
      type: CourseType,
      description: 'Particular Course',
      args: {
        id: { type: GraphQLInt }
      },
      resolve: (parent, args) => courses.find(course => course.id === args.id)
    },
    student: { // para buscar un student por id
      type: StudentType,
      description: 'Particular Student',
      args: {
        id: { type: GraphQLInt }
      },
      resolve: (parent, args) => students.find(student => student.id === args.id)
    },
    grade: { // para buscar un grade por id
      type: GradeType,
      description: 'Particular Grade',
      args: {
        id: { type: GraphQLInt }
      },
      resolve: (parent, args) => grades.find(grade => grade.id === args.id)
    }
  }),
});

const RootMutationType = new GraphQLObjectType({
  name: 'Mutation',
  description: 'Root Mutation',
  fields: () => ({
/**---------------ADDS----------------**/
    addStudent: {
      type: StudentType,
      description: 'Add a Student',
      args: {
        firstName: { type: GraphQLNonNull(GraphQLString) },
        lastName: { type: GraphQLNonNull(GraphQLString) },
        courseId: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const courseExist = courses.find(course => args.courseId === course.id);
        if(courseExist) {
          const student = {
            id: students[students.length - 1].id + 1,
            firstName: args.firstName,
            lastName: args.lastName,
            courseId : args.courseId
          };
          students.push(student);
          return student;
        } else {
          return new GraphQLError(`Course with id ${args.courseId} is not found on Database`);
        }
      }
    },
    addCourse: {
      type: CourseType,
      description: 'Add a Course',
      args: {
        name: { type: GraphQLNonNull(GraphQLString) },
        description: { type: GraphQLNonNull(GraphQLString) },
      },
      resolve: (parent, args) => {
        const course = {
          id: courses[courses.length - 1].id + 1,
          name: args.name,
          description: args.description,
        };
        courses.push(course);
        return course;
      }
    },
    addGrade: {
      type: GradeType,
      description: 'Add a Grade',
      args: {
        courseId: { type: GraphQLNonNull(GraphQLInt) },
        studentId: { type: GraphQLNonNull(GraphQLInt) },
        grade: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        //para hacer un correcto manejo de errores por cada caso me valido si:
        //existe el curso - existe el alumno - si el alumno esta inscripto al curso - si la nota de ese curso para ese alumno ya fue puesta (en ese caso hacer updateGrade)
        const courseExist = courses.find(course => args.courseId === course.id);
        const studentExist = students.find(student => args.studentId === student.id);
        const studentExistAndCourse = students.find(student => (args.studentId === student.id && args.courseId === student.courseId));
        const gradeExist = grades.find(grade =>
          (args.courseId === grade.courseId && args.studentId === grade.studentId)
        );
        if(courseExist && studentExist && studentExistAndCourse) {
          if(gradeExist) {
            return new GraphQLError({ error: `Grade for Student id ${args.studentId} of Course id ${args.courseId} already exists, it can be updated with 'updateGrade'`, currentData: gradeExist });
          } else {
            const grade = {
              id: grades[grades.length - 1].id + 1,
              courseId : args.courseId,
              studentId : args.studentId,
              grade : args.grade,
            };
            grades.push(grade);
            return grade;
          }
        } else if(!courseExist) {
          return new GraphQLError(`Course with id ${args.courseId} not found on Database`);
        } else if(!studentExist) {
          return new GraphQLError(`Student with id ${args.studentId} not found on Database`);
        } else if(!studentExistAndCourse) {
          return new GraphQLError(`The Student with id ${args.studentId} not be inscripted in the Course ${args.courseId}`);
        }
      }
    },
/**---------------UPDATES----------------**/
    updateStudent: {
      type: StudentType,
      description: 'Update a Student',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
        firstName: { type: GraphQLNonNull(GraphQLString) },
        lastName: { type: GraphQLNonNull(GraphQLString) },
        courseId: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const studentExist = students.find(student => args.id === student.id );
        const courseExist = courses.find(course => args.courseId === course.id);
        if(studentExist) {
          if(!courseExist) {
            return new GraphQLError(`Course with id ${args.courseId} is not found on Database`);
          } else {
            const student = {
              id: args.id,
              firstName: args.firstName,
              lastName: args.lastName,
              courseId: args.courseId
            };
            Object.assign(studentExist, student);
            return studentExist;
          }
        } else {
          return new GraphQLError(`The Student with id ${args.id} is not found on Database`);
        }
      }
    },
    updateCourse: {
      type: CourseType,
      description: 'Update a Course',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
        name: { type: GraphQLNonNull(GraphQLString) },
        description: { type: GraphQLNonNull(GraphQLString) },
      },
      resolve: (parent, args) => {
        const courseExist = courses.find(course => args.id === course.id);
        if(courseExist){
          const course = {
            id: args.id,
            name: args.name,
            description: args.description,
          };
          Object.assign(courseExist, course);
          return courseExist;
        }  else {
          return new GraphQLError(`Course with id ${args.id} is not found on Database`);
        }
      }
    },
    updateGrade: {
      type: GradeType,
      description: 'Update a Grade',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
        courseId: { type: GraphQLNonNull(GraphQLInt) },
        studentId: { type: GraphQLNonNull(GraphQLInt) },
        grade: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const gradeExist = grades.find(grade => args.id === grade.id);
        const courseExist = courses.find(course => args.courseId === course.id);
        const studentExist = students.find(student => args.studentId === student.id);
          if(gradeExist) {
            const grade = {
              id: args.id,
              courseId : args.courseId,
              studentId : args.studentId,
              grade : args.grade,
            };
            Object.assign(gradeExist, grade);
            return gradeExist;
          } else if(!courseExist) {
            return new GraphQLError(`Course with id ${args.courseId} is not found on Database`);
          } else if(!studentExist) {
            return new GraphQLError(`Student with id ${args.studentId} is not found on Database`);
          } else {
            return new GraphQLError(`Grade with id ${args.id} is not found on Database`);
          }
      }
    },
/**---------------DELETES----------------**/
    deleteStudent: {
      type: StudentType,
      description: 'Delete a Student',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const studentExist = students.find(student => args.id === student.id);
        if(!studentExist) return new GraphQLError(`Student with id ${args.id} is not found on Database`);
        _.remove(students, (student) => {
          return student.id === args.id;
        });
      }
    },
    deleteCourse: {
      type: CourseType,
      description: 'Delete a Course',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const courseExist = courses.find(course => args.id === course.id);
        const studentExist = students.find(student => args.id === student.courseId);
        if(!courseExist) return new GraphQLError(`Course with id ${args.id} is not found on Database`);
        if(studentExist) return new GraphQLError(`Course with id ${args.id} has Students asociated. It should not be deleted. It can be used 'deleteCourseWithAllStudents'`);
        _.remove(courses, (course) => {
          return course.id === args.id;
        });
      }
    },
    deleteGrade: {
      type: GradeType,
      description: 'Delete a Grade',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const gradeExist = grades.find(grade => args.id === grade.id);
        if(!gradeExist) return new GraphQLError(`Grade with id ${args.id} is not found on Database`);
        _.remove(grades, (grade) => {
          return grade.id === args.id;
        });
      }
    },
    deleteCourseWithAllStudents: {
      type: CourseType,
      description: 'Delete a Course with all Students',
      args: {
        id: { type: GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const courseExist = courses.find(course => args.id === course.id);
        if(!courseExist) return new GraphQLError(`Course with id ${args.id} is not found on Database`);
        _.remove(students, (student) => {
          return student.courseId === args.id;
        });
        _.remove(courses, (course) => {
          return course.id === args.id;
        });
      }
    },
  })
});

const schema = new GraphQLSchema({
  query: RootQueryType,
  mutation: RootMutationType
});

app.use('/graphql', expressGraphQL({
  schema: schema,
  graphiql: true
}));

const port = 3001;

app.listen(port, ()=>{
  console.log(`Server running at port ${port}`);
});
