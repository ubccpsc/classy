"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("../../../packages/common/Log");
const CourseController_1 = require("../../../packages/portal/backend/src/controllers/CourseController");
class DefaultCourseController extends CourseController_1.CourseController {
    constructor(ghController) {
        Log_1.default.trace("DefaultCourseController::<init>");
        super(ghController);
    }
}
exports.DefaultCourseController = DefaultCourseController;
//# sourceMappingURL=CustomCourseController.js.map