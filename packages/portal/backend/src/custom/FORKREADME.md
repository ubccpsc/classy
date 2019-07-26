# Fork Customization

This folder must contain at least two files:

* Copy `DefaultCourseController.ts` to create `CustomCourseController.ts`. `CustomCourseController` extends `CourseController`, which is used for the most common course-specific overrides that require code

* Copy `DefaultCourseRoutes.ts` to create `CustomCourseRoutes.ts`. `CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend.


Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
  