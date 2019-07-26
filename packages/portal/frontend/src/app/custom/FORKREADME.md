# Fork Customization

This folder must contain at least one file `CustomStudentView.ts`. This file must contain one default class that extends `AbstractStudentView`. 

An optional file called `CustomAdminView.ts` containing a class that extends `AdminView` can also be added. 

Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
  

OR 

  # Fork Customization

This folder contains a `DefaultStudentView.ts` and `DefaultAdminView.ts` file. 

The `../custom` folder found in `src/app/custom` allows you to implement custom `admin` and `student` user views in your Classy fork. Custom view instructions:

- Create a `CustomStudentView.ts` file under `./custom` that extends the `AbstractStudentView` class. 
- Create a `CustomAdminView.ts` file that extends the `AdminView` class. 

DO NOTHING to use the default business logic of the `DefaultStudentView.ts` and `DefaultAdminView.ts` controllers in the `../default` folder.

<!-- Any custom controllers should ***NOT*** be pushed back to `classy/master`. -->