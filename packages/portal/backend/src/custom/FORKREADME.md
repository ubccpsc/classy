# Fork Customization

This folder must contain two files:

* `CustomCourseController.ts` should extend `CourseController`. This class is used for the most common course-specific overrides that require code. 

* `CustomCourseRoutes.ts` should implement `IREST`. This is where you can define any custom REST routes required by the backend.An optional file called `CustomAdminView.ts` containing a class that extends `AdminView` can also be added. 

Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
  