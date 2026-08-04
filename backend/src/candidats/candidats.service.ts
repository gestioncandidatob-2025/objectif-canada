import { Injectable, NotFoundException } from '@nestjs/common';
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

  async update(id: string, updateCandidatDto: UpdateCandidatDto, modifiePar: string) {
    const { raison, ...champs } = updateCandidatDto;

    const champsModifies = Object.keys(champs)
      .filter((cle) => champs[cle as keyof typeof champs] !== undefined)
      .join(', ');

    const candidat = await this.candidatModel
      .findByIdAndUpdate(
        id,
        {
          $set: champs,
          $push: {
            historique: {
              raison,
              modifiePar,
              champsModifies: champsModifies || 'aucun champ',
              date: new Date(),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }
    return candidat;
  }
  async remove(id: string) {
    const candidat = await this.candidatModel.findByIdAndDelete(id).exec();
    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }
    return candidat;
  }
}