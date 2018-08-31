# CPSC340 Frontend

### Things to note:
* Deliverable Editing page has some custom injected code when rendering the deliverable information.  
If you are creating a new deliverable, you can specify if the deliverable is an assignment by using
the toggle switch. This will open up a new section to input assignment parameters.

* Admin Config page also has some custom injected code, handling functions
like releasing final grades and manual controlling assignments.

* There are two grading views, one for viewing all student's grades (across all
assignments), and the other for viewing the student's grade
for a specific deliverable.

* Grading page is generated based on the rubric, which is specified in
the assignment information. 

* The grades view shows all students who _have been uploaded by csv_ **and**
who are _still registered_ in the org.


<!-- 
## Design Choices:
     
Custom code is run on page loads, through `renderPage()`.
--->
