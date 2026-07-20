import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidat, CandidatDocument } from './schemas/candidat.schema';
import { CreateCandidatDto } from './dto/create-candidat.dto';
import { UpdateCandidatDto } from './dto/update-candidat.dto';

@Injectable()
export class CandidatsService {
  constructor(
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
  ) {}

  create(createCandidatDto: CreateCandidatDto) {
    const candidat = new this.candidatModel(createCandidatDto);
    return candidat.save();
  }

  findAll(nom?: string) {
    if (nom) {
      return this.candidatModel
        .find({
          $or: [
            { nom: { $regex: nom, $options: 'i' } },
            { prenom: { $regex: nom, $options: 'i' } },
          ],
        })
        .exec();
    }
    return this.candidatModel.find().exec();
  }

  findOne(id: string) {
    return this.candidatModel.findById(id).exec();
  }

  update(id: string, updateCandidatDto: UpdateCandidatDto) {
    return this.candidatModel
      .findByIdAndUpdate(id, updateCandidatDto, { new: true })
      .exec();
  }

  remove(id: string) {
    return this.candidatModel.findByIdAndDelete(id).exec();
  }
}