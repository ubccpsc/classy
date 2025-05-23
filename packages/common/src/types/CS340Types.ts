// /**
//  * DEPRECATED
//  *
//  * 340 is not using Classy anymore, these can probably be removed.
//  */
//
// /**
//  * Custom type definitions, to be placed inside the custom field
//  */
//
// // Placed in  Grade.custom
// // Represents an Assignment grade, comprised of an arbitrary amount of Questions
// // TODO [WISHLIST]: Remove AssignmentGrade from having studentID and assignmentID (redundant, grade already tracks this)
//
// export interface AssignmentGrade {
// 	assignmentID: string; // Unique Assignment ID per course
// 	studentID: string; // Unique Student ID per course
// 	released: boolean; // status if assignment grade has been released or not
// 	questions: QuestionGrade[]; // SubQuestions
// }
//
// // Represents the grade for a question, comprised of an arbitrary amount of subQuestions
// export interface QuestionGrade {
// 	questionName: string;
// 	commentName: string;
// 	subQuestion: SubQuestionGrade[];
// }
//
// // Represents the grade for the subQuestion
// export interface SubQuestionGrade {
// 	sectionName: string;
// 	grade: number;
// 	graded: boolean;
// 	feedback: string;
// }
//
// // Placed in Deliverable.custom
// export interface AssignmentInfo {
// 	seedRepoURL: string;
// 	seedRepoPath: string;
// 	mainFilePath: string;
// 	courseWeight: number; // should be a value between 0-1, relative to the final grade
// 	status: AssignmentStatus;
// 	rubric: AssignmentGradingRubric;
// 	repositories: string[]; // Associated Repositories based on IDs
// }
//
// // Placed in Repository.custom
// export interface AssignmentRepositoryInfo {
// 	assignmentId: string[];
// 	status: AssignmentStatus;
// 	assignedTeams: string[]; // team.id[]
// }
//
// // Represents a grading rubric
// export interface AssignmentGradingRubric {
// 	name: string;
// 	comment: string; // placeholders for future use
// 	questions: QuestionGradingRubric[];
// }
//
// // Represents a question rubric
// export interface QuestionGradingRubric {
// 	name: string;
// 	comment: string; // placeholders for future use
// 	subQuestions: SubQuestionGradingRubric[];
// }
//
// export interface SubQuestionGradingRubric {
// 	name: string;
// 	comment: string;
// 	outOf: number;
// 	weight: number; // score multiplier for the total grade
// 	modifiers: any; // Custom modifiers - course dependant
// }
//
// export enum AssignmentStatus {
// 	// Repositories Status:
// 	// Created | Pull | Push  |
// 	INACTIVE, //    = 1,        //         |      |       | Repositories not created or viewable
// 	CREATED, //     = 2,        //    X    |      |       | Repositories are created, not viewable
// 	RELEASED, //    = 3,        //    X    |  X   |   X   | Created and viewable, with push access
// 	CLOSED, //      = 4,        //    X    |  X   |       | Created, viewable, no push access
// }
//
// // Contains information about deliverables
// export interface DeliverableInfo {
// 	id: string;
// 	minStudents: number;
// 	maxStudents: number;
// }
//
// /*
// export interface CategoricalGradeRecord extends CategoricalRecord {
//     grade: number;
// }
//
// export interface CategoricalRecord {
//     name: string;
//     comment: string;
// }
// */
