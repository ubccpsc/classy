/**
 * Custom type definitions, to be placed inside the custom field
 */

// Represents an Assignment grade, comprised of an arbitrary amount of Questions
export interface AssignmentGrade {
    assignmentID: string;               // Unique Assignment ID per course
    studentID: string;                  // Unique Student ID per course
    questions: QuestionGrade[];    // SubQuestions
}

// Represents the Question's grade, comprised of an arbitrary amount of subQuestions
export interface QuestionGrade {
    questionName: string;
    commentName: string;
    subQuestion: SubQuestionGrade[];
}

// Represents the subQuestion's grade
export interface SubQuestionGrade {
    sectionName: string;
    grade: number;
    feedback: string;
}

// Represents a grading rubric
export interface AssignmentGradingRubric {
    name: string;
    comment: string;
    questions: QuestionGradingRubric[];
}

// Represents a question rubric
export interface QuestionGradingRubric {
    name: string;
    comment: string;
    subQuestions: SubQuestionGradingRubric[];
}

export interface SubQuestionGradingRubric {
    name: string;
    comment: string;
    outOf: number;
    weight: number;
    modifiers: any;         // Custom modifiers - course dependant
}

/*
export interface CategoricalGradeRecord extends CategoricalRecord {
    grade: number;
}

export interface CategoricalRecord {
    name: string;
    comment: string;
}
*/
