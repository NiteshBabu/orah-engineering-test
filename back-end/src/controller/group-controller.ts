import { NextFunction, Request, Response } from "express"
import { getRepository } from "typeorm"
import { GroupStudent } from "../entity/group-student.entity"
import { Group } from "../entity/group.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { Student } from "../entity/student.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private studentRepository = getRepository(Student)
  private rollRepository = getRepository(Roll)
  private studetnRollRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      run_at: params.run_at,
      student_count: params.student_count,
    }

    // Add a Group
    const group = new Group()
    group.prepareToCreate(createGroupInput)
    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    // Update a Group
    const group = await this.groupRepository.findOne(params.id)

    if (group === undefined) return response.json({ body: "Not Found" })

    const updateGroupInput: UpdateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      run_at: params.run_at,
      student_count: params.student_count,
    }

    group.prepareToUpdate(updateGroupInput)

    return this.groupRepository.save(group)
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    // Delete a Group

    const group = await this.groupRepository.findOne(params.id)
    if (group === undefined) return response.json({ body: "Not Found" })

    return this.groupRepository.remove(group)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request
    const groupStudents = await this.groupStudentRepository.find({ group_id: params.group_id })
    let promises = groupStudents.map((s) =>
      this.studentRepository.findOne({ id: s.student_id }).then((student) => {
        return {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: `${student.first_name} ${student.last_name}`,
        }
      })
    )
    // Return the list of Students that are in a Group
    return await Promise.all(promises)
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:

    // 1. Clear out the groups (delete all the students from the groups)
    this.groupStudentRepository.find().then((studentGroup) => this.groupStudentRepository.remove(studentGroup))

    // 2. For each group, query the student rolls to see which students match the filter for the group
    const group = await this.groupRepository.findOne({ id: request.query.id })
    group.run_at = new Date()

    // fetch roll state, matching group's roll_states
    const rollState = await this.rollRepository.findOne({ name: group.roll_states })
    
    // fetch students present with same roll state
    const studentsInRollState = await this.studetnRollRepository.find({ roll_id: rollState.id })
    
    // No. of students matching filter
    group.student_count = studentsInRollState.length

    // // 3. Add the list of students that match the filter to the group
    let seen = null
    studentsInRollState.map(async (s) => {
      if (!seen) {
        seen = s.student_id
        this.insertIntoGroupStudent(group, studentsInRollState, s)
      }
      if (seen != s.student_id) {
        this.insertIntoGroupStudent(group, studentsInRollState, s)
        seen = s.student_id
      }
    })

    // })
    return this.groupRepository.save(group)
  }

  public insertIntoGroupStudent(group, studentsInRollState ,s){
    const count = studentsInRollState.filter((x) => s.student_id === x.student_id).length
    console.log(count, group.incidents)
    if (group.ltmt === "<" && count < group.incidents) {
      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate({
        student_id: s.student_id,
        group_id: group.id,
        incident_count: count,
      })
      this.groupStudentRepository.save(groupStudent)
    }
    if (group.ltmt === ">" && count > group.incidents) {
      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate({
        student_id: s.student_id,
        group_id: group.id,
        incident_count: count,
      })
      this.groupStudentRepository.save(groupStudent)
    }
  }
}
