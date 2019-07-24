# Fork Customization

This folder contains a `DefaultStudentView.ts` and `DefaultAdminView.ts` file. 

The `../custom` folder found in `src/app/custom` allows you to implement a custom `admin` and `student` user roles in your Classy fork. Custom view instructions:

- Create a `CustomStudentView.ts` file under `./custom` that extends the `AbstractStudentView` class. 
- Create a `CustomAdminView.ts` file that extends the `AdminView` class. 

DO NOTHING to use the default business logic of the `DefaultStudentView.ts` and `DefaultAdminView.ts` controllers in the `../default` folder.

Any custom controllers should ***NOT*** be pushed back to `classy/master`.